import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useCollection } from '../../hooks/useCollection';
import { requestAuth, isAuthed, createEvent } from '../../lib/googleCalendar';
import Button from '../../components/ui/Button';
import Input, { Textarea } from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import styles from './ScheduleDate.module.css';

const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID;

const BLANK_FORM = {
  idea:        '',
  date:        '',
  time:        '18:00',
  duration:    90,
  location:    '',
  notes:       '',
  vibes:       [],
};

export default function ScheduleDate() {
  const { docs: ideas } = useCollection('dateIdeas', 'createdAt');
  const { add: addHistory } = useCollection('scheduledDates', 'createdAt');

  const [form, setForm]         = useState(BLANK_FORM);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [step, setStep]         = useState('input'); // 'input' | 'preview' | 'done'

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // --- Step 1: Ask AI to fill in the details ---
  const handleAiGenerate = async (e) => {
    e.preventDefault();
    if (!form.idea.trim()) return;
    setAiLoading(true);
    setAiResult(null);

    try {
      const res = await fetch('/api/generate-event', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea:          form.idea,
          preferredDate: form.date || null,
          preferredTime: form.time || null,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Merge AI suggestions into form
      setForm((f) => ({
        ...f,
        time:     data.suggestedTime     ?? f.time,
        duration: data.suggestedDuration ?? f.duration,
        location: data.location          ?? f.location,
        notes:    data.description       ?? f.notes,
      }));
      setAiResult(data);
      setStep('preview');
    } catch (err) {
      toast.error('AI generation failed: ' + (err.message ?? 'unknown error'));
    } finally {
      setAiLoading(false);
    }
  };

  // --- Step 2: Confirm — create Google Calendar event + save to Firebase ---
  const handleSchedule = async () => {
    setSaving(true);

    try {
      // Ensure Google is authed (may prompt)
      if (!isAuthed()) await requestAuth();

      // Build RFC 3339 datetimes
      const startDt = new Date(`${form.date}T${form.time}:00`);
      const endDt   = new Date(startDt.getTime() + form.duration * 60 * 1000);

      const calEvent = {
        summary:     form.idea,
        location:    form.location,
        description: form.notes,
        start:       { dateTime: startDt.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end:         { dateTime: endDt.toISOString(),   timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      };

      const created = await createEvent(CALENDAR_ID, calEvent);

      // Save record to Firebase
      await addHistory({
        idea:         form.idea,
        date:         form.date,
        time:         form.time,
        duration:     form.duration,
        location:     form.location,
        notes:        form.notes,
        vibes:        aiResult?.vibes ?? [],
        calEventId:   created.id,
        calEventLink: created.htmlLink,
      });

      setStep('done');
      toast.success('Date scheduled ♡');
    } catch (err) {
      toast.error('Failed to schedule: ' + (err.message ?? 'unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { setForm(BLANK_FORM); setAiResult(null); setStep('input'); };

  return (
    <div className={styles.wrapper}>
      <AnimatePresence mode="wait">
        {/* ---- Step 1: Input ---- */}
        {step === 'input' && (
          <motion.div key="input" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
            <Card className={styles.card}>
              <h2 className={styles.cardTitle}>Schedule a Date</h2>
              <p className={styles.cardSub}>
                Describe your idea and Claude AI will suggest the details, then
                create it on your shared calendar.
              </p>

              <form onSubmit={handleAiGenerate} className={styles.form}>
                {/* Idea input with datalist from Firebase */}
                <div className={styles.group}>
                  <label className={styles.label}>Date idea</label>
                  <input
                    className={styles.ideaInput}
                    list="ideas-list"
                    placeholder="e.g. Sunset picnic at the botanical garden"
                    value={form.idea}
                    onChange={(e) => set('idea', e.target.value)}
                    required
                  />
                  <datalist id="ideas-list">
                    {ideas.map((i) => <option key={i.id} value={i.title} />)}
                  </datalist>
                </div>

                <div className={styles.row}>
                  <Input
                    label="Preferred date (optional)"
                    type="date"
                    value={form.date}
                    onChange={(e) => set('date', e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className={styles.half}
                  />
                  <Input
                    label="Preferred time (optional)"
                    type="time"
                    value={form.time}
                    onChange={(e) => set('time', e.target.value)}
                    className={styles.half}
                  />
                </div>

                <Button type="submit" loading={aiLoading} size="lg" className={styles.generateBtn}>
                  {aiLoading ? 'AI is planning…' : '✦ Generate with AI'}
                </Button>
              </form>
            </Card>
          </motion.div>
        )}

        {/* ---- Step 2: Preview & edit AI result ---- */}
        {step === 'preview' && (
          <motion.div key="preview" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
            <Card className={styles.card}>
              <div className={styles.previewHeader}>
                <h2 className={styles.cardTitle}>Review Your Date</h2>
                <p className={styles.aiNote}>✦ Suggested by Claude AI — edit anything</p>
              </div>

              {/* Vibe tags */}
              {aiResult?.vibes?.length > 0 && (
                <div className={styles.vibes}>
                  {aiResult.vibes.map((v) => (
                    <Badge key={v} variant="rose">{v}</Badge>
                  ))}
                </div>
              )}

              <div className={styles.form}>
                <div className={styles.group}>
                  <label className={styles.label}>Date idea</label>
                  <p className={styles.ideaDisplay}>{form.idea}</p>
                </div>

                <div className={styles.row}>
                  <Input
                    label="Date"
                    type="date"
                    value={form.date}
                    onChange={(e) => set('date', e.target.value)}
                    required
                    className={styles.half}
                  />
                  <Input
                    label="Time"
                    type="time"
                    value={form.time}
                    onChange={(e) => set('time', e.target.value)}
                    className={styles.half}
                  />
                </div>

                <Input
                  label="Duration (minutes)"
                  type="number"
                  min={15} max={600} step={15}
                  value={form.duration}
                  onChange={(e) => set('duration', +e.target.value)}
                />

                <Input
                  label="Location"
                  placeholder="Where are you going?"
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                />

                <Textarea
                  label="Notes / description"
                  placeholder="Anything to remember…"
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />

                <div className={styles.previewActions}>
                  <Button variant="ghost" onClick={() => setStep('input')}>← Back</Button>
                  <Button
                    onClick={handleSchedule}
                    loading={saving}
                    disabled={!form.date}
                    size="lg"
                  >
                    Add to Calendar ♡
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ---- Step 3: Done ---- */}
        {step === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity:0, scale:0.9 }}
            animate={{ opacity:1, scale:1 }}
            className={styles.doneWrapper}
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className={styles.doneHeart}
            >
              ♡
            </motion.div>
            <h2 className={styles.doneTitle}>It's on the calendar!</h2>
            <p className={styles.doneSub}>{form.idea} is all set.</p>
            <Button onClick={reset} variant="ghost">Schedule another</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
