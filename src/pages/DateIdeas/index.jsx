import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../../components/layout/PageTransition';
import styles from './DateIdeas.module.css';
import IdeaList from './IdeaList';
import SurpriseMe from './SurpriseMe';
import ScheduleDate from './ScheduleDate';

const TABS = [
  { id: 'list',      label: 'All Ideas',    icon: '✧' },
  { id: 'surprise',  label: 'Surprise Me',  icon: '✦' },
  { id: 'schedule',  label: 'Schedule',     icon: '📅' },
];

export default function DateIdeas() {
  const [activeTab, setActiveTab] = useState('list');

  return (
    <PageTransition className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className="container">
          <h1 className={styles.title}>Date Ideas</h1>
          <p className={styles.subtitle}>Things we want to do together</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <div className={`container ${styles.tabInner}`}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {activeTab === tab.id && (
                <motion.div className={styles.tabIndicator} layoutId="tab-indicator" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="container">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === 'list'     && <IdeaList />}
            {activeTab === 'surprise' && <SurpriseMe />}
            {activeTab === 'schedule' && <ScheduleDate />}
          </motion.div>
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
