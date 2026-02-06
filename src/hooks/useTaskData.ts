import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface TaskData {
  id: string;
  title: string;
  duration: number;
  iconName: string;
  colorClass: string;
  sortOrder: number;
  notes: string;
}

export interface ProgressMap {
  [taskId: string]: boolean;
}

export function useTaskData(user: User | null) {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [historicalDates, setHistoricalDates] = useState<string[]>([]);

  // Load tasks from DB
  const loadTasks = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setTasks(data.map(t => ({
        id: t.id,
        title: t.title,
        duration: t.duration,
        iconName: t.icon_name,
        colorClass: t.color_class,
        sortOrder: t.sort_order,
        notes: t.notes || '',
      })));
    }
    setLoading(false);
  }, [user]);

  // Load historical dates
  const loadHistoricalDates = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('task_progress')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (data) {
      const uniqueDates = [...new Set(data.map(d => d.date))];
      setHistoricalDates(uniqueDates);
    }
  }, [user]);

  // Load progress for a date
  const loadProgress = useCallback(async (date: string): Promise<ProgressMap> => {
    if (!user) return {};
    const { data } = await supabase
      .from('task_progress')
      .select('task_id, completed')
      .eq('user_id', user.id)
      .eq('date', date);

    if (data) {
      const map: ProgressMap = {};
      data.forEach(d => { map[d.task_id] = d.completed; });
      return map;
    }
    return {};
  }, [user]);

  // Load start time for a date
  const loadStartTime = useCallback(async (date: string): Promise<number> => {
    if (!user) return 360;
    const { data } = await supabase
      .from('day_settings')
      .select('start_time')
      .eq('user_id', user.id)
      .eq('date', date)
      .maybeSingle();

    return data?.start_time ?? 360;
  }, [user]);

  // Save start time
  const saveStartTime = useCallback(async (date: string, startTime: number) => {
    if (!user) return;
    await supabase
      .from('day_settings')
      .upsert({ user_id: user.id, date, start_time: startTime }, { onConflict: 'user_id,date' });
  }, [user]);

  // Toggle task progress
  const toggleProgress = useCallback(async (taskId: string, date: string, currentVal: boolean) => {
    if (!user) return;
    await supabase
      .from('task_progress')
      .upsert(
        { user_id: user.id, task_id: taskId, date, completed: !currentVal },
        { onConflict: 'user_id,task_id,date' }
      );
  }, [user]);

  // Add task
  const addTask = useCallback(async (title: string, duration: number, notes: string, iconName: string, colorClass: string) => {
    if (!user) return;
    const sortOrder = tasks.length;
    const { data } = await supabase
      .from('user_tasks')
      .insert({
        user_id: user.id,
        title,
        duration,
        notes,
        icon_name: iconName,
        color_class: colorClass,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (data) {
      setTasks(prev => [...prev, {
        id: data.id,
        title: data.title,
        duration: data.duration,
        iconName: data.icon_name,
        colorClass: data.color_class,
        sortOrder: data.sort_order,
        notes: data.notes || '',
      }]);
    }
  }, [user, tasks.length]);

  // Update task
  const updateTask = useCallback(async (taskId: string, updates: Partial<{ title: string; duration: number; notes: string }>) => {
    if (!user) return;
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    await supabase.from('user_tasks').update(dbUpdates).eq('id', taskId).eq('user_id', user.id);

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  }, [user]);

  // Delete task
  const deleteTask = useCallback(async (taskId: string) => {
    if (!user) return;
    await supabase.from('user_tasks').delete().eq('id', taskId).eq('user_id', user.id);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, [user]);

  // Reorder tasks
  const reorderTasks = useCallback(async (newTasks: TaskData[]) => {
    if (!user) return;
    setTasks(newTasks);
    // Update sort orders in DB
    const updates = newTasks.map((t, i) => 
      supabase.from('user_tasks').update({ sort_order: i }).eq('id', t.id).eq('user_id', user.id)
    );
    await Promise.all(updates);
  }, [user]);

  // Seed default tasks for new users
  const seedDefaultTasks = useCallback(async () => {
    if (!user) return;
    const defaults = [
      { title: 'Morning Messages & Meditation', duration: 30, icon_name: 'Sun', color_class: 'bg-gradient-to-br from-amber-400 to-orange-500' },
      { title: 'Exercise', duration: 60, icon_name: 'Dumbbell', color_class: 'bg-gradient-to-br from-rose-400 to-pink-500' },
      { title: 'Job Hunting', duration: 60, icon_name: 'Briefcase', color_class: 'bg-gradient-to-br from-sky-400 to-cyan-500' },
      { title: 'Selenium Automation Training', duration: 120, icon_name: 'Code', color_class: 'bg-gradient-to-br from-emerald-400 to-green-500' },
      { title: 'ML Engineer Training', duration: 180, icon_name: 'Brain', color_class: 'bg-gradient-to-br from-violet-400 to-purple-500' },
      { title: 'Business Development', duration: 120, icon_name: 'TrendingUp', color_class: 'bg-gradient-to-br from-pink-400 to-rose-500' },
    ];

    const inserts = defaults.map((t, i) => ({
      user_id: user.id,
      title: t.title,
      duration: t.duration,
      icon_name: t.icon_name,
      color_class: t.color_class,
      sort_order: i,
      notes: '',
    }));

    const { data } = await supabase.from('user_tasks').insert(inserts).select();
    if (data) {
      setTasks(data.map(t => ({
        id: t.id,
        title: t.title,
        duration: t.duration,
        iconName: t.icon_name,
        colorClass: t.color_class,
        sortOrder: t.sort_order,
        notes: t.notes || '',
      })));
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTasks().then(() => {});
      loadHistoricalDates();
    }
  }, [user, loadTasks, loadHistoricalDates]);

  return {
    tasks,
    loading,
    historicalDates,
    loadTasks,
    loadHistoricalDates,
    loadProgress,
    loadStartTime,
    saveStartTime,
    toggleProgress,
    addTask,
    updateTask,
    deleteTask,
    reorderTasks,
    seedDefaultTasks,
  };
}
