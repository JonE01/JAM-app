import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Real-time Firestore collection hook.
 * Returns { docs, add, update, remove, loading, error }.
 */
export function useCollection(collectionName, orderByField = 'createdAt') {
  const [docs, setDocs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, collectionName),
      orderBy(orderByField, 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [collectionName, orderByField]);

  async function add(data) {
    return addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp(),
    });
  }

  async function update(id, data) {
    return updateDoc(doc(db, collectionName, id), data);
  }

  async function remove(id) {
    return deleteDoc(doc(db, collectionName, id));
  }

  return { docs, add, update, remove, loading, error };
}
