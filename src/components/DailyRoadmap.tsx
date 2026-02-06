import React, { useState, useEffect, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import { 
  CheckCircle2, Circle, Sun, Dumbbell, Briefcase, Code, Brain, 
  TrendingUp, Clock, Target, Award, Edit2, Save, X, Plus, Minus, 
  Trash2, PlusCircle, GripVertical, ChevronUp, ChevronDown, RotateCcw,
  Sparkles, Calendar, Timer, Zap, LogOut, ChevronLeft, ChevronRight,
  StickyNote, MessageSquare
} from 'lucide-react';
import cityBackground from '@/assets/city-skyline-bg.jpg';
import { useAuth } from '@/hooks/useAuth';
import { useTaskData, type TaskData, type ProgressMap } from '@/hooks/useTaskData';
import { toast } from '@/components/ui/sonner';

// Icon map for resolving icon names from DB
const iconMap: Record<string, LucideIcon> = {
  Sun, Dumbbell, Briefcase, Code, Brain, TrendingUp, Target, Award, Clock, Zap,
};
const iconNames = Object.keys(iconMap);
const colorClasses = [
  'bg-gradient-to-br from-amber-400 to-orange-500',
  'bg-gradient-to-br from-rose-400 to-pink-500',
  'bg-gradient-to-br from-sky-400 to-cyan-500',
  'bg-gradient-to-br from-emerald-400 to-green-500',
  'bg-gradient-to-br from-violet-400 to-purple-500',
  'bg-gradient-to-br from-pink-400 to-rose-500',
  'bg-gradient-to-br from-orange-400 to-red-500',
  'bg-gradient-to-br from-cyan-400 to-blue-500',
];

const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const DailyRoadmap: React.FC = () => {
  const { user, signOut } = useAuth();
  const taskData = useTaskData(user);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [startTime, setStartTimeLocal] = useState<number>(360);
  const [weekProgress, setWeekProgress] = useState<Record<string, { total: number; completed: number; percentage: number }>>({});
  
  // UI states
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddTask, setShowAddTask] = useState<boolean>(false);
  const [newTaskName, setNewTaskName] = useState<string>('');
  const [newTaskNotes, setNewTaskNotes] = useState<string>('');
  const [newTaskDuration, setNewTaskDuration] = useState<number>(60);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const isToday = selectedDate === todayStr;
  const { tasks } = taskData;

  // Seed defaults for new users
  useEffect(() => {
    if (!taskData.loading && tasks.length === 0 && user && initialLoad) {
      taskData.seedDefaultTasks();
      setInitialLoad(false);
    } else if (tasks.length > 0) {
      setInitialLoad(false);
    }
  }, [taskData.loading, tasks.length, user, initialLoad]);

  // Load progress & start time for selected date
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [prog, st] = await Promise.all([
        taskData.loadProgress(selectedDate),
        taskData.loadStartTime(selectedDate),
      ]);
      setProgress(prog);
      setStartTimeLocal(st);
    };
    load();
  }, [user, selectedDate, taskData.loadProgress, taskData.loadStartTime]);

  // Build week progress
  useEffect(() => {
    if (!user) return;
    const buildWeek = async () => {
      const today = new Date();
      const weekData: Record<string, { total: number; completed: number; percentage: number }> = {};
      const promises = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        promises.push(
          taskData.loadProgress(dateStr).then(prog => {
            const completed = Object.values(prog).filter(v => v).length;
            const total = tasks.length || 1;
            weekData[dateStr] = { total, completed, percentage: Math.round((completed / total) * 100) };
          })
        );
      }
      await Promise.all(promises);
      setWeekProgress(weekData);
    };
    if (tasks.length > 0) buildWeek();
  }, [user, tasks.length, taskData.loadProgress]);

  // Calculate task times
  const tasksWithTimes = (() => {
    let currentTime = startTime;
    return tasks.map(task => {
      const taskStart = currentTime;
      const taskEnd = currentTime + task.duration;
      currentTime = taskEnd;
      return {
        ...task,
        startTime: taskStart,
        endTime: taskEnd,
        timeRange: `${formatTime(taskStart)} - ${formatTime(taskEnd)}`,
      };
    });
  })();

  const endTime = tasksWithTimes.length > 0 ? tasksWithTimes[tasksWithTimes.length - 1].endTime : startTime;

  // Task actions
  const toggleTask = async (taskId: string) => {
    const currentVal = progress[taskId] || false;
    setProgress(prev => ({ ...prev, [taskId]: !currentVal }));
    await taskData.toggleProgress(taskId, selectedDate, currentVal);
  };

  const adjustTaskDuration = async (taskId: string, change: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newDuration = Math.max(15, task.duration + change);
    await taskData.updateTask(taskId, { duration: newDuration });
  };

  const startEditingName = (taskId: string, currentName: string) => {
    setEditingName(taskId);
    setTempName(currentName);
  };

  const saveTaskName = async (taskId: string) => {
    if (tempName.trim()) {
      await taskData.updateTask(taskId, { title: tempName.trim() });
    }
    setEditingName(null);
    setTempName('');
  };

  const cancelEditingName = () => {
    setEditingName(null);
    setTempName('');
  };

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      await taskData.deleteTask(taskId);
    }
  };

  const addNewTask = async () => {
    if (newTaskName.trim()) {
      const randomIcon = iconNames[Math.floor(Math.random() * iconNames.length)];
      const randomColor = colorClasses[Math.floor(Math.random() * colorClasses.length)];
      await taskData.addTask(newTaskName.trim(), newTaskDuration, newTaskNotes.trim(), randomIcon, randomColor);
      setNewTaskName('');
      setNewTaskNotes('');
      setNewTaskDuration(60);
      setShowAddTask(false);
    }
  };

  // Notes editing
  const startEditingNotes = (taskId: string, currentNotes: string) => {
    setEditingNotes(taskId);
    setTempNotes(currentNotes);
  };

  const saveNotes = async (taskId: string) => {
    await taskData.updateTask(taskId, { notes: tempNotes.trim() });
    setEditingNotes(null);
    setTempNotes('');
  };

  const cancelEditingNotes = () => {
    setEditingNotes(null);
    setTempNotes('');
  };

  // Drag and drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newTasks = [...tasks];
    const draggedTask = newTasks[draggedIndex];
    newTasks.splice(draggedIndex, 1);
    newTasks.splice(index, 0, draggedTask);
    taskData.reorderTasks(newTasks);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleTouchStart = (index: number) => {
    setDraggedIndex(index);
  };

  // Start time controls
  const adjustStartTime = async (change: number) => {
    const newStartTime = Math.max(0, Math.min(1380, startTime + change));
    setStartTimeLocal(newStartTime);
    await taskData.saveStartTime(selectedDate, newStartTime);
  };

  const resetStartTime = async () => {
    setStartTimeLocal(360);
    await taskData.saveStartTime(selectedDate, 360);
  };

  // Historical dates navigation
  const allDates = (() => {
    const dates = new Set<string>([todayStr, ...taskData.historicalDates]);
    return [...dates].sort().reverse();
  })();

  const navigateDate = (direction: 'prev' | 'next') => {
    const idx = allDates.indexOf(selectedDate);
    if (direction === 'prev' && idx < allDates.length - 1) {
      setSelectedDate(allDates[idx + 1]);
    } else if (direction === 'next' && idx > 0) {
      setSelectedDate(allDates[idx - 1]);
    }
  };

  // Progress calculations
  const completedCount = Object.values(progress).filter(v => v).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const totalMinutes = tasks.reduce((sum, task) => sum + task.duration, 0);
  const totalHours = totalMinutes / 60;
  const perfectDays = Object.keys(weekProgress).filter(date => weekProgress[date]?.percentage === 100).length;

  const getMotivationalMessage = () => {
    if (progressPercentage === 100) return { emoji: '🎉', text: "Incredible! You've completed all tasks today!" };
    if (progressPercentage >= 75) return { emoji: '🔥', text: "Almost there! You're on fire!" };
    if (progressPercentage >= 50) return { emoji: '💪', text: "Great progress! Keep going strong!" };
    if (progressPercentage >= 25) return { emoji: '🚀', text: "Nice momentum! Keep pushing forward!" };
    return { emoji: '🌟', text: "Every journey begins with a single step. You've got this!" };
  };

  const motivation = getMotivationalMessage();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
  };

  if (taskData.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${cityBackground})` }} />
        <div className="fixed inset-0 bg-gradient-to-br from-background/50 via-background/40 to-background/60" />
        <div className="relative z-10 animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Background Image */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${cityBackground})` }}
      />
      
      {/* Overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-background/50 via-background/40 to-background/60" />

      {/* Content */}
      <div className="relative z-10 p-3 sm:p-6 md:p-8 pb-20">
        <div className="max-w-5xl mx-auto">
          
          {/* Top Bar with Logout */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs sm:text-sm text-muted-foreground truncate">
              {user?.email}
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-destructive/20 rounded-lg transition-colors text-muted-foreground hover:text-destructive text-xs sm:text-sm"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>

          {/* Header */}
          <header className="text-center mb-6 sm:mb-8 animate-fade-in">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="text-accent" size={24} />
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-foreground drop-shadow-lg">
                Daily Success Roadmap
              </h1>
              <Sparkles className="text-accent" size={24} />
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Calendar size={18} />
              <p className="text-sm sm:text-lg font-medium">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { 
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                })}
              </p>
            </div>
          </header>

          {/* Historical Date Navigation */}
          <section className="glass rounded-xl p-3 sm:p-4 shadow-xl mb-4 sm:mb-6 animate-fade-in">
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              <button
                onClick={() => navigateDate('prev')}
                disabled={allDates.indexOf(selectedDate) >= allDates.length - 1}
                className="p-2 bg-primary/20 hover:bg-primary/30 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="text-primary" size={18} />
              </button>
              
              <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto max-w-[70vw] sm:max-w-lg scrollbar-hide">
                {allDates.slice(0, 14).map(date => {
                  const d = new Date(date + 'T12:00:00');
                  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNum = d.getDate();
                  const isSelected = date === selectedDate;
                  const isTodayDate = date === todayStr;
                  return (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`flex-shrink-0 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                          : isTodayDate
                            ? 'bg-primary/20 text-primary hover:bg-primary/30'
                            : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <div className="text-[10px] sm:text-xs">{dayName}</div>
                      <div>{dayNum}</div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => navigateDate('next')}
                disabled={allDates.indexOf(selectedDate) <= 0}
                className="p-2 bg-primary/20 hover:bg-primary/30 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="text-primary" size={18} />
              </button>
            </div>
            {!isToday && (
              <div className="text-center mt-2">
                <button
                  onClick={() => setSelectedDate(todayStr)}
                  className="text-xs text-primary hover:underline font-semibold"
                >
                  ← Back to Today
                </button>
              </div>
            )}
          </section>

          {/* Progress Card */}
          <section className="glass rounded-2xl p-4 sm:p-6 shadow-2xl mb-4 sm:mb-6 animate-slide-up">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-primary to-secondary rounded-xl shadow-lg glow-primary">
                  <Target className="text-primary-foreground" size={24} />
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">
                    {isToday ? "Today's Progress" : "Day's Progress"}
                  </h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Timer size={14} />
                    Total: {totalHours.toFixed(1)} hours
                  </p>
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl sm:text-5xl font-extrabold text-gradient drop-shadow-lg">
                  {progressPercentage}%
                </div>
                <div className="text-muted-foreground text-xs sm:text-sm">
                  {completedCount} of {totalTasks} tasks
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="relative mb-6">
              <div className="w-full bg-muted/50 rounded-full h-4 sm:h-6 shadow-inner overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-success via-primary to-secondary h-full rounded-full transition-all duration-700 ease-out shadow-lg flex items-center justify-end pr-2 sm:pr-3 progress-bar-animate"
                  style={{ width: `${progressPercentage}%` }}
                >
                  {progressPercentage > 15 && (
                    <span className="text-foreground font-bold text-xs drop-shadow">
                      {completedCount}/{totalTasks}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Week View */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {Object.entries(weekProgress).map(([date, data]) => {
                const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                const isTodayDate = date === todayStr;
                return (
                  <div 
                    key={date} 
                    className={`text-center p-1.5 sm:p-3 rounded-lg transition-all duration-300 cursor-pointer ${
                      isTodayDate 
                        ? 'bg-primary/20 ring-2 ring-primary/50' 
                        : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedDate(date)}
                  >
                    <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">{dayName}</div>
                    <div className={`text-sm sm:text-lg font-bold ${
                      data.percentage === 100 ? 'text-success' : 'text-foreground'
                    }`}>
                      {data.percentage}%
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-1 sm:h-1.5 mt-1">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          data.percentage === 100 
                            ? 'bg-success' 
                            : 'bg-gradient-to-r from-primary to-secondary'
                        }`}
                        style={{ width: `${data.percentage}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Start Time Control */}
          <section className="glass rounded-xl p-3 sm:p-4 shadow-xl mb-4 sm:mb-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">Start:</span>
                <span className="font-bold text-lg sm:text-xl text-foreground">{formatTime(startTime)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustStartTime(-15)}
                  className="p-2 bg-primary/20 hover:bg-primary/30 rounded-lg transition-all active:scale-95"
                  title="Start 15 min earlier"
                >
                  <ChevronUp className="text-primary" size={18} />
                </button>
                <button
                  onClick={() => adjustStartTime(15)}
                  className="p-2 bg-primary/20 hover:bg-primary/30 rounded-lg transition-all active:scale-95"
                  title="Start 15 min later"
                >
                  <ChevronDown className="text-primary" size={18} />
                </button>
                <button
                  onClick={resetStartTime}
                  className="p-2 bg-muted/30 hover:bg-muted/50 rounded-lg transition-all active:scale-95"
                  title="Reset to 06:00"
                >
                  <RotateCcw className="text-muted-foreground" size={18} />
                </button>
              </div>

              <div className="hidden sm:block w-px h-8 bg-border" />
              
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">End:</span>
                <span className="font-bold text-lg sm:text-xl text-foreground">{formatTime(endTime)}</span>
              </div>
            </div>
          </section>

          {/* Add Task Button / Form */}
          {isToday && (
            <section className="mb-4 sm:mb-6">
              {!showAddTask ? (
                <button
                  onClick={() => setShowAddTask(true)}
                  className="w-full bg-gradient-to-r from-success to-emerald-500 hover:from-success/90 hover:to-emerald-500/90 text-success-foreground font-bold py-3 sm:py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base active:scale-[0.99]"
                >
                  <PlusCircle size={20} />
                  Add New Task
                </button>
              ) : (
                <div className="glass rounded-xl p-4 sm:p-6 shadow-xl animate-scale-in">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-4">Add New Task</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-muted-foreground text-xs sm:text-sm mb-2 block">Task Name</label>
                      <input
                        type="text"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        placeholder="Enter task name..."
                        className="w-full bg-muted/30 border border-border rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground text-xs sm:text-sm mb-2 block flex items-center gap-1.5">
                        <StickyNote size={14} />
                        Notes (optional)
                      </label>
                      <textarea
                        value={newTaskNotes}
                        onChange={(e) => setNewTaskNotes(e.target.value)}
                        placeholder="Add short notes about this task..."
                        className="w-full bg-muted/30 border border-border rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base resize-none"
                        rows={2}
                        maxLength={500}
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground text-xs sm:text-sm mb-2 block">Duration</label>
                      <div className="flex items-center gap-2 sm:gap-4">
                        <button
                          onClick={() => setNewTaskDuration(Math.max(15, newTaskDuration - 15))}
                          className="p-2 sm:p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors"
                        >
                          <Minus className="text-foreground" size={18} />
                        </button>
                        <div className="flex-grow bg-muted/30 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-foreground text-center font-bold text-sm sm:text-base">
                          {formatDuration(newTaskDuration)}
                        </div>
                        <button
                          onClick={() => setNewTaskDuration(newTaskDuration + 15)}
                          className="p-2 sm:p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors"
                        >
                          <Plus className="text-foreground" size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 sm:gap-3">
                      <button
                        onClick={addNewTask}
                        className="flex-1 bg-success hover:bg-success/90 text-success-foreground font-bold py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base"
                      >
                        Add Task
                      </button>
                      <button
                        onClick={() => { setShowAddTask(false); setNewTaskName(''); setNewTaskNotes(''); setNewTaskDuration(60); }}
                        className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Not Today Banner */}
          {!isToday && (
            <div className="glass rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border-accent/30 text-center">
              <p className="text-muted-foreground text-sm">
                📅 Viewing <strong className="text-foreground">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong> — Read-only historical view
              </p>
            </div>
          )}

          {/* Tasks List */}
          <section className="space-y-3 sm:space-y-4">
            {tasksWithTimes.map((task, index) => {
              const Icon = iconMap[task.iconName] || Sun;
              const isCompleted = progress[task.id] || false;
              const isEditingThisName = editingName === task.id;
              const isEditingThisNotes = editingNotes === task.id;
              const isDragging = draggedIndex === index;
              const isHovered = hoveredTask === task.id;
              
              return (
                <div 
                  key={task.id} 
                  className="relative task-enter" 
                  style={{ animationDelay: `${index * 50}ms` }}
                  onMouseEnter={() => setHoveredTask(task.id)}
                  onMouseLeave={() => setHoveredTask(null)}
                >
                  {/* Flow connector */}
                  {index < tasksWithTimes.length - 1 && (
                    <div className="absolute left-6 sm:left-10 top-full w-0.5 h-3 sm:h-4 bg-gradient-to-b from-primary/50 to-transparent z-0" />
                  )}
                  
                  <div 
                    className={`relative glass rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-xl transition-all duration-300 ${
                      isCompleted 
                        ? 'ring-2 ring-success/50 bg-success/10 glow-success' 
                        : 'hover:ring-2 hover:ring-primary/30'
                    } ${isDragging ? 'opacity-50 scale-95' : 'hover:scale-[1.01]'}`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                      {/* Drag Handle */}
                      {isToday && (
                        <div 
                          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-1"
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          onTouchStart={() => handleTouchStart(index)}
                        >
                          <GripVertical className="text-muted-foreground" size={16} />
                        </div>
                      )}

                      {/* Checkbox */}
                      <button 
                        className="flex-shrink-0"
                        onClick={() => toggleTask(task.id)}
                      >
                        {isCompleted ? (
                          <div className="p-1.5 sm:p-2 bg-success rounded-full shadow-lg transition-transform hover:scale-110">
                            <CheckCircle2 className="text-success-foreground" size={20} />
                          </div>
                        ) : (
                          <div className="p-1.5 sm:p-2 bg-muted/30 rounded-full border-2 border-muted-foreground/30 transition-all hover:border-primary/50 hover:bg-primary/10">
                            <Circle className="text-muted-foreground" size={20} />
                          </div>
                        )}
                      </button>

                      {/* Icon */}
                      <div className={`p-2 sm:p-3 ${task.colorClass} rounded-lg sm:rounded-xl shadow-lg flex-shrink-0`}>
                        <Icon className="text-white" size={20} />
                      </div>

                      {/* Content */}
                      <div className="flex-grow min-w-0">
                        {isEditingThisName ? (
                          <div className="flex items-center gap-1 sm:gap-2 mb-2">
                            <input
                              type="text"
                              value={tempName}
                              onChange={(e) => setTempName(e.target.value)}
                              className="flex-grow bg-muted/30 border border-border rounded-lg px-2 sm:px-3 py-1 sm:py-2 text-foreground text-sm sm:text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                              onKeyDown={(e) => e.key === 'Enter' && saveTaskName(task.id)}
                              maxLength={100}
                              autoFocus
                            />
                            <button
                              onClick={() => saveTaskName(task.id)}
                              className="p-1.5 sm:p-2 bg-success hover:bg-success/90 rounded-lg transition-colors flex-shrink-0"
                            >
                              <Save className="text-success-foreground" size={16} />
                            </button>
                            <button
                              onClick={cancelEditingName}
                              className="p-1.5 sm:p-2 bg-destructive hover:bg-destructive/90 rounded-lg transition-colors flex-shrink-0"
                            >
                              <X className="text-destructive-foreground" size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 sm:gap-2 mb-1">
                            <h3 className={`text-sm sm:text-lg md:text-xl font-bold truncate ${
                              isCompleted ? 'text-success line-through' : 'text-foreground'
                            }`}>
                              {task.title}
                            </h3>
                            {/* Notes indicator - visible on hover, clickable */}
                            {task.notes ? (
                              <button
                                onClick={() => startEditingNotes(task.id, task.notes)}
                                className="p-1 bg-accent/20 hover:bg-accent/40 rounded-lg transition-colors flex-shrink-0"
                                title={task.notes}
                              >
                                <MessageSquare className="text-accent" size={12} />
                              </button>
                            ) : isToday && (
                              <button
                                onClick={() => startEditingNotes(task.id, '')}
                                className={`p-1 bg-muted/20 hover:bg-muted/40 rounded-lg transition-all flex-shrink-0 ${
                                  isHovered ? 'opacity-100' : 'opacity-0'
                                }`}
                                title="Add notes"
                              >
                                <StickyNote className="text-muted-foreground" size={12} />
                              </button>
                            )}
                            {isToday && (
                              <button
                                onClick={() => startEditingName(task.id, task.title)}
                                className="p-1 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0"
                              >
                                <Edit2 className="text-muted-foreground" size={12} />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Notes hover tooltip */}
                        {task.notes && isHovered && !isEditingThisNotes && (
                          <div 
                            className="mb-2 bg-accent/10 border border-accent/20 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-foreground/80 cursor-pointer hover:bg-accent/20 transition-colors animate-fade-in"
                            onClick={() => isToday && startEditingNotes(task.id, task.notes)}
                          >
                            <span className="text-accent font-semibold">📝 </span>
                            {task.notes}
                          </div>
                        )}

                        {/* Inline notes editor */}
                        {isEditingThisNotes && (
                          <div className="mb-2 flex items-start gap-1 sm:gap-2 animate-fade-in">
                            <textarea
                              value={tempNotes}
                              onChange={(e) => setTempNotes(e.target.value)}
                              placeholder="Add short notes..."
                              className="flex-grow bg-muted/30 border border-border rounded-lg px-2 sm:px-3 py-1.5 text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                              rows={2}
                              maxLength={500}
                              autoFocus
                            />
                            <button
                              onClick={() => saveNotes(task.id)}
                              className="p-1.5 bg-success hover:bg-success/90 rounded-lg transition-colors flex-shrink-0"
                            >
                              <Save className="text-success-foreground" size={14} />
                            </button>
                            <button
                              onClick={cancelEditingNotes}
                              className="p-1.5 bg-destructive hover:bg-destructive/90 rounded-lg transition-colors flex-shrink-0"
                            >
                              <X className="text-destructive-foreground" size={14} />
                            </button>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs sm:text-sm">
                          {/* Duration Control */}
                          <div className="flex items-center gap-1 bg-muted/30 rounded-lg px-2 py-1">
                            {isToday && (
                              <button
                                onClick={() => adjustTaskDuration(task.id, -15)}
                                className="p-0.5 hover:bg-muted/50 rounded transition-colors"
                              >
                                <Minus size={12} className="text-foreground" />
                              </button>
                            )}
                            <div className="flex items-center gap-1 min-w-[50px] justify-center">
                              <Clock size={12} />
                              <span className="font-bold text-xs text-foreground">
                                {formatDuration(task.duration)}
                              </span>
                            </div>
                            {isToday && (
                              <button
                                onClick={() => adjustTaskDuration(task.id, 15)}
                                className="p-0.5 hover:bg-muted/50 rounded transition-colors"
                              >
                                <Plus size={12} className="text-foreground" />
                              </button>
                            )}
                          </div>

                          {/* Time Range */}
                          <span className="text-xs font-bold bg-gradient-to-r from-primary/20 to-secondary/20 px-2 sm:px-3 py-1 rounded-full border border-border">
                            {task.timeRange}
                          </span>
                        </div>
                      </div>

                      {/* Delete Button */}
                      {isToday && (
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 bg-destructive/80 hover:bg-destructive rounded-lg transition-colors flex-shrink-0"
                        >
                          <Trash2 className="text-destructive-foreground" size={16} />
                        </button>
                      )}
                    </div>

                    {/* Progress line */}
                    <div className={`mt-3 h-1 rounded-full ${isCompleted ? 'bg-success' : 'bg-muted/30'}`} />
                  </div>
                </div>
              );
            })}
          </section>

          {/* Motivational Message */}
          <section className="mt-6 sm:mt-8 glass rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl border-accent/30 animate-fade-in">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="text-4xl">{motivation.emoji}</div>
              <Award className="text-accent flex-shrink-0" size={32} />
              <div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground mb-1">
                  {motivation.text}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Consistency is the key to success. Track your daily progress and watch yourself grow!
                </p>
              </div>
            </div>
          </section>

          {/* Statistics */}
          <section className="mt-4 sm:mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <div className="glass rounded-lg sm:rounded-xl p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-primary">{totalHours.toFixed(1)}h</div>
              <div className="text-muted-foreground text-xs sm:text-sm">Daily Investment</div>
            </div>
            <div className="glass rounded-lg sm:rounded-xl p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-success">{completedCount}</div>
              <div className="text-muted-foreground text-xs sm:text-sm">Completed</div>
            </div>
            <div className="glass rounded-lg sm:rounded-xl p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-secondary">{totalTasks - completedCount}</div>
              <div className="text-muted-foreground text-xs sm:text-sm">Remaining</div>
            </div>
            <div className="glass rounded-lg sm:rounded-xl p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-accent">{perfectDays}</div>
              <div className="text-muted-foreground text-xs sm:text-sm">Perfect Days</div>
            </div>
          </section>

          {/* Tips */}
          <section className="mt-4 sm:mt-6 glass rounded-lg sm:rounded-xl p-3 sm:p-4 border-primary/30">
            <p className="text-muted-foreground text-xs sm:text-sm text-center">
              <strong className="text-foreground">Tips:</strong> ⋮⋮ Drag to reorder • ✏️ Edit to rename • ±15min to adjust time • 🗑️ to delete • ➕ to add • 📝 Hover for notes
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DailyRoadmap;
