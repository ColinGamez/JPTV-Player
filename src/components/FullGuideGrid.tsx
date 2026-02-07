import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { EpgChannel, EpgProgram } from '../types/epg';
import styles from './FullGuideGrid.module.css';

interface FullGuideGridProps {
  channels: EpgChannel[];
  visible: boolean;
  onClose: () => void;
  onProgramSelect?: (program: EpgProgram) => void;
}

interface TimeSlot {
  start: number;
  label: string;
}

const SLOT_WIDTH = 180; // 30 minutes = 180px
const SLOT_DURATION = 30 * 60 * 1000; // 30 minutes in ms
const CHANNEL_HEIGHT = 80;
const TIME_HEADER_HEIGHT = 50;
const CHANNEL_SIDEBAR_WIDTH = 200;

export const FullGuideGrid: React.FC<FullGuideGridProps> = ({
  channels,
  visible,
  onClose,
  onProgramSelect
}) => {
  const [guideData, setGuideData] = useState<Map<string, EpgProgram[]>>(new Map());
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<EpgProgram | null>(null);
  const [loading, setLoading] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const gridRef = useRef<HTMLDivElement>(null);
  const timeHeaderRef = useRef<HTMLDivElement>(null);
  const channelSidebarRef = useRef<HTMLDivElement>(null);

  // Generate time slots (48 hours, 30-minute intervals)
  useEffect(() => {
    const now = Date.now();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const slots: TimeSlot[] = [];
    const hours = 48; // 2 days
    const slotsPerHour = 2; // 30-minute intervals
    
    for (let i = 0; i < hours * slotsPerHour; i++) {
      const time = startOfDay.getTime() + (i * SLOT_DURATION);
      const date = new Date(time);
      slots.push({
        start: time,
        label: date.toLocaleTimeString('ja-JP', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        })
      });
    }
    
    setTimeSlots(slots);
  }, []);

  // Load guide data for visible channels
  useEffect(() => {
    if (!visible || channels.length === 0 || timeSlots.length === 0) return;

    const loadGuideData = async () => {
      setLoading(true);
      try {
        const startTime = timeSlots[0].start;
        const endTime = timeSlots[timeSlots.length - 1].start + SLOT_DURATION;
        const channelIds = channels.map(c => c.id);

        const guideWindow = await window.electron?.epg?.getGuideWindow?.(
          channelIds,
          startTime,
          endTime
        );

        if (guideWindow) {
          setGuideData(guideWindow.data);
        }
      } catch (err) {
        console.error('Failed to load guide data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadGuideData();
  }, [visible, channels, timeSlots]);

  // Sync scroll positions
  const handleGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
    setScrollLeft(target.scrollLeft);

    if (timeHeaderRef.current) {
      timeHeaderRef.current.scrollLeft = target.scrollLeft;
    }
    if (channelSidebarRef.current) {
      channelSidebarRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  // Get program block style
  const getProgramStyle = (program: EpgProgram): React.CSSProperties => {
    if (timeSlots.length === 0) return { left: '0px', width: '0px' };
    const startSlot = Math.floor((program.start - timeSlots[0].start) / SLOT_DURATION);
    const duration = program.stop - program.start;
    const width = (duration / SLOT_DURATION) * SLOT_WIDTH;

    return {
      left: `${startSlot * SLOT_WIDTH}px`,
      width: `${width}px`
    };
  };

  // Get category color
  const getCategoryColor = (categories?: string[]): string => {
    if (!categories || categories.length === 0) return '#4a9eff';
    
    const category = categories[0].toLowerCase();
    if (category.includes('news')) return '#ff6b6b';
    if (category.includes('sports')) return '#51cf66';
    if (category.includes('drama')) return '#be4bdb';
    if (category.includes('movie')) return '#ffd43b';
    if (category.includes('variety')) return '#ff8c42';
    if (category.includes('documentary')) return '#339af0';
    if (category.includes('anime')) return '#f06595';
    
    return '#4a9eff';
  };

  // Format time for program
  const formatProgramTime = (start: number, stop: number): string => {
    const startDate = new Date(start);
    const stopDate = new Date(stop);
    
    return `${startDate.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })} - ${stopDate.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })}`;
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Program guide">
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Program Guide</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close program guide">
            ✕
          </button>
        </div>

        {/* Grid container */}
        <div className={styles.gridContainer}>
          {/* Top-left corner */}
          <div className={styles.corner} />

          {/* Time header */}
          <div 
            ref={timeHeaderRef}
            className={styles.timeHeader}
            style={{ overflow: 'hidden' }}
          >
            <div 
              className={styles.timeSlots}
              style={{ width: `${timeSlots.length * SLOT_WIDTH}px` }}
            >
              {timeSlots.map((slot, index) => (
                <div 
                  key={index}
                  className={styles.timeSlot}
                  style={{ width: `${SLOT_WIDTH}px` }}
                >
                  {slot.label}
                </div>
              ))}
            </div>
          </div>

          {/* Channel sidebar */}
          <div 
            ref={channelSidebarRef}
            className={styles.channelSidebar}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ height: `${channels.length * CHANNEL_HEIGHT}px` }}>
              {channels.map((channel, index) => (
                <div 
                  key={channel.id}
                  className={styles.channelRow}
                  style={{ 
                    height: `${CHANNEL_HEIGHT}px`,
                    top: `${index * CHANNEL_HEIGHT}px`
                  }}
                >
                  <div className={styles.channelName}>{channel.displayName}</div>
                  <div className={styles.channelId}>{channel.id}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Program grid */}
          <div 
            ref={gridRef}
            className={styles.programGrid}
            onScroll={handleGridScroll}
          >
            <div 
              className={styles.gridContent}
              style={{ 
                width: `${timeSlots.length * SLOT_WIDTH}px`,
                height: `${channels.length * CHANNEL_HEIGHT}px`
              }}
            >
              {loading ? (
                <div className={styles.loading}>Loading guide data...</div>
              ) : (
                channels.map((channel, channelIndex) => {
                  const programs = guideData.get(channel.id) || [];
                  
                  return (
                    <div 
                      key={channel.id}
                      className={styles.channelTrack}
                      style={{ 
                        top: `${channelIndex * CHANNEL_HEIGHT}px`,
                        height: `${CHANNEL_HEIGHT}px`
                      }}
                    >
                      {programs.map((program, programIndex) => (
                        <div
                          key={`${program.channelId}-${programIndex}`}
                          className={styles.programBlock}
                          style={{
                            ...getProgramStyle(program),
                            background: getCategoryColor(program.categories)
                          }}
                          onClick={() => {
                            setSelectedProgram(program);
                            onProgramSelect?.(program);
                          }}
                        >
                          <div className={styles.programTitle}>
                            {program.title}
                          </div>
                          <div className={styles.programTime}>
                            {formatProgramTime(program.start, program.stop)}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Program details */}
        {selectedProgram && (
          <div className={styles.detailsPanel}>
            <h3 className={styles.detailsTitle}>{selectedProgram.title}</h3>
            <div className={styles.detailsTime}>
              {formatProgramTime(selectedProgram.start, selectedProgram.stop)}
            </div>
            {selectedProgram.description && (
              <p className={styles.detailsDescription}>
                {selectedProgram.description}
              </p>
            )}
            {selectedProgram.categories && selectedProgram.categories.length > 0 && (
              <div className={styles.detailsCategories}>
                {selectedProgram.categories.map((cat, idx) => (
                  <span key={idx} className={styles.categoryTag}>
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
