import { useCollection } from './useCollection';

export const DEFAULT_TAGS = [
  { id: 'restaurant', name: 'Restaurant', emoji: '🍜', color: '#C9A96E', isDefault: true },
  { id: 'park',       name: 'Park',       emoji: '🌿', color: '#6BAE75', isDefault: true },
  { id: 'cafe',       name: 'Café',       emoji: '☕', color: '#9B7A3C', isDefault: true },
  { id: 'date-spot',  name: 'Date Spot',  emoji: '♡',  color: '#C0606A', isDefault: true },
  { id: 'activity',   name: 'Activity',   emoji: '✦',  color: '#7B6FA0', isDefault: true },
  { id: 'other',      name: 'Other',      emoji: '◦',  color: '#9A7A6A', isDefault: true },
];

const TAG_COLORS = [
  '#C0606A', '#C9A96E', '#6BAE75', '#9B7A3C',
  '#7B6FA0', '#5B8FB9', '#C05E8A', '#7A9E7E',
];

export function useTags() {
  const { docs: custom, add, remove } = useCollection('tags', 'createdAt');

  const tags = [
    ...DEFAULT_TAGS,
    ...custom.map((t, i) => ({
      id:        t.id,
      name:      t.name,
      emoji:     t.emoji,
      color:     t.color ?? TAG_COLORS[i % TAG_COLORS.length],
      isDefault: false,
    })),
  ];

  async function addTag(name, emoji) {
    const color = TAG_COLORS[custom.length % TAG_COLORS.length];
    return add({ name: name.trim(), emoji, color });
  }

  async function removeTag(id) {
    return remove(id);
  }

  // Find a tag by id, fall back to 'other'
  function getTag(id) {
    return tags.find((t) => t.id === id) ?? tags.find((t) => t.id === 'other') ?? tags[0];
  }

  return { tags, addTag, removeTag, getTag };
}
