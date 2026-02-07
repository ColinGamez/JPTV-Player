/**
 * EpgGrid - Virtualized EPG Grid Component
 * 
 * Features:
 * - Virtualized rendering for 200+ channels
 * - Time-based horizontal scrolling
 * - Keyboard navigation
 * - Program blocks with progress bars
 */

import React, { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { EpgStore, EpgProgram } from '../epg/EpgStore';
import type { Channel } from '../types/channel';
import type { Channel as MockChannel } from '../data/mockData';
import styles from './EpgGrid.module.css';

interface EpgGridProps {
  epgStore: EpgStore;
  channels: (Channel | MockChannel)[];
  timeSpanHours: number;
  timeBlockMinutes: number;
  favorites: string[];
  onSelectProgram: (program: EpgProgram, channelId: string) => void;
  onFocusChange?: (channelId: string, timeMs: number) => void;
  initialScrollX?: number;
  initialScrollY?: number;
  initialFocusedChannelId?: string;
  initialFocusedTimeMs?: number;
}

interface ProgramBlock {
  program: EpgProgram;
  left: number;
  width: number;
  isNow: boolean;
  progress: number;
}

const CHANNEL_ROW_HEIGHT = 60;
const TIME_BLOCK_WIDTH_PX = 200; // px per time block
const CHANNEL_COLUMN_WIDTH = 180;
const TIME_RULER_HEIGHT = 50;

// Data passed to virtualized Row via itemData prop
interface RowItemData {
  channels: (Channel | MockChannel)[];
  focusedChannelIndex: number;
  favorites: string[];
  buildProgramBlocks: (channelId: string) => ProgramBlock[];
}

// Extracted Row component — stable reference for react-window virtualization
const Row = memo(({ index, style, data }: ListChildComponentProps<RowItemData>) => {
  const { channels, focusedChannelIndex, favorites, buildProgramBlocks } = data;
  const channel = channels[index];
  const channelId = String(channel.id);
  const isFocused = index === focusedChannelIndex;
  const isFavorite = favorites.includes(channelId);

  const blocks = buildProgramBlocks(channelId);

  return (
    <div style={style} className={`${styles.row} ${isFocused ? styles.focused : ''}`}>
      <div className={styles.channelCell}>
        <div className={styles.channelLogo}>
          {channel.logo ? (
            <img src={channel.logo} alt={channel.name} />
          ) : (
            <div className={styles.placeholder}>{channel.name[0]}</div>
          )}
        </div>
        <div className={styles.channelName}>
          {isFavorite && <span className={styles.star}>★</span>}
          {channel.name}
        </div>
      </div>
      <div className={styles.programsCell}>
        {blocks.map((block, idx) => (
          <div
            key={idx}
            className={`${styles.programBlock} ${block.isNow ? styles.nowPlaying : ''}`}
            style={{
              left: block.left,
              width: block.width
            }}
            title={`${block.program.title}\n${formatTime(block.program.startMs)} - ${formatTime(block.program.endMs)}`}
          >
            <div className={styles.programTitle}>{block.program.title}</div>
            {block.program.category && (
              <div className={styles.programCategory}>{block.program.category}</div>
            )}
            {block.isNow && (
              <div className={styles.progressBar} style={{ transform: `scaleX(${(block.progress ?? 0) / 100})` }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

export const EpgGrid: React.FC<EpgGridProps> = ({
  epgStore,
  channels,
  timeSpanHours,
  timeBlockMinutes,
  favorites,
  onSelectProgram,
  onFocusChange,
  initialScrollX = 0,
  initialScrollY = 0,
  initialFocusedChannelId,
  initialFocusedTimeMs
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const [scrollLeft, setScrollLeft] = useState(initialScrollX);
  const [focusedChannelIndex, setFocusedChannelIndex] = useState(0);
  const [focusedTimeMs, setFocusedTimeMs] = useState(Date.now());
  const [nowMs, setNowMs] = useState(Date.now());

  // Update "now" time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate time range
  const timeRange = useMemo(() => {
    const startMs = Date.now();
    const endMs = startMs + (timeSpanHours * 60 * 60 * 1000);
    return { startMs, endMs };
  }, [timeSpanHours]);

  // Time blocks for ruler
  const timeBlocks = useMemo(() => {
    const blocks: Array<{ timeMs: number; label: string }> = [];
    const blockMs = timeBlockMinutes * 60 * 1000;
    
    let currentMs = Math.floor(timeRange.startMs / blockMs) * blockMs;
    
    while (currentMs < timeRange.endMs) {
      blocks.push({
        timeMs: currentMs,
        label: formatTime(currentMs)
      });
      currentMs += blockMs;
    }
    
    return blocks;
  }, [timeRange, timeBlockMinutes]);

  // Convert time to pixel position
  const timeToPx = useCallback((timeMs: number): number => {
    const blockMs = timeBlockMinutes * 60 * 1000;
    const blocksFromStart = (timeMs - timeRange.startMs) / blockMs;
    return blocksFromStart * TIME_BLOCK_WIDTH_PX;
  }, [timeRange.startMs, timeBlockMinutes]);

  // Convert pixel to time
  const pxToTime = useCallback((px: number): number => {
    const blockMs = timeBlockMinutes * 60 * 1000;
    const blocks = px / TIME_BLOCK_WIDTH_PX;
    return timeRange.startMs + (blocks * blockMs);
  }, [timeRange.startMs, timeBlockMinutes]);

  // Build program blocks for a channel
  const buildProgramBlocks = useCallback((channelId: string): ProgramBlock[] => {
    const programs = epgStore.getProgramsInRange(
      channelId,
      timeRange.startMs,
      timeRange.endMs
    );

    return programs.map(program => {
      const left = timeToPx(program.startMs);
      const right = timeToPx(program.endMs);
      const width = Math.max(right - left, 10); // Min 10px
      
      const isNow = nowMs >= program.startMs && nowMs < program.endMs;
      const progress = isNow 
        ? ((nowMs - program.startMs) / (program.endMs - program.startMs)) * 100
        : 0;

      return {
        program,
        left,
        width,
        isNow,
        progress
      };
    });
  }, [epgStore, timeRange, timeToPx, nowMs]);

  // Initialize focus
  useEffect(() => {
    if (initialFocusedChannelId) {
      const index = channels.findIndex(ch => String(ch.id) === initialFocusedChannelId);
      if (index >= 0) {
        setFocusedChannelIndex(index);
      }
    }
    if (initialFocusedTimeMs) {
      setFocusedTimeMs(initialFocusedTimeMs);
    }
  }, []);

  // Notify focus changes
  useEffect(() => {
    if (onFocusChange && channels[focusedChannelIndex]) {
      const channelId = String(channels[focusedChannelIndex].id);
      onFocusChange(channelId, focusedTimeMs);
    }
  }, [focusedChannelIndex, focusedTimeMs, channels, onFocusChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedChannelIndex(prev => Math.max(0, prev - 1));
        listRef.current?.scrollToItem(Math.max(0, focusedChannelIndex - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedChannelIndex(prev => Math.min(channels.length - 1, prev + 1));
        listRef.current?.scrollToItem(Math.min(channels.length - 1, focusedChannelIndex + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newTimeMs = focusedTimeMs - (timeBlockMinutes * 60 * 1000);
        setFocusedTimeMs(Math.max(timeRange.startMs, newTimeMs));
        scrollToTime(newTimeMs);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newTimeMs = focusedTimeMs + (timeBlockMinutes * 60 * 1000);
        setFocusedTimeMs(Math.min(timeRange.endMs, newTimeMs));
        scrollToTime(newTimeMs);
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        const newIndex = Math.max(0, focusedChannelIndex - 5);
        setFocusedChannelIndex(newIndex);
        listRef.current?.scrollToItem(newIndex);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        const newIndex = Math.min(channels.length - 1, focusedChannelIndex + 5);
        setFocusedChannelIndex(newIndex);
        listRef.current?.scrollToItem(newIndex);
      } else if (e.key === 'Home') {
        e.preventDefault();
        const newTimeMs = timeRange.startMs;
        setFocusedTimeMs(newTimeMs);
        scrollToTime(newTimeMs);
      } else if (e.key === 'End') {
        e.preventDefault();
        const newTimeMs = timeRange.endMs - (60 * 60 * 1000);
        setFocusedTimeMs(newTimeMs);
        scrollToTime(newTimeMs);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const channel = channels[focusedChannelIndex];
        if (channel) {
          const channelId = String(channel.id);
          const program = epgStore.getNow(channelId, focusedTimeMs);
          if (program) {
            onSelectProgram(program, channelId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [focusedChannelIndex, focusedTimeMs, channels, timeBlockMinutes, timeRange, epgStore, onSelectProgram]);

  const scrollToTime = (timeMs: number) => {
    const px = timeToPx(timeMs);
    if (timelineRef.current) {
      timelineRef.current.scrollLeft = px - (window.innerWidth / 2);
    }
  };

  // Sync timeline scroll
  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    setScrollLeft(scrollLeft);
    
    // Update focused time based on scroll
    const centerTimeMs = pxToTime(scrollLeft + (window.innerWidth / 2));
    setFocusedTimeMs(centerTimeMs);
  };

  // Stable itemData for virtualized Row (memoized to prevent unnecessary re-renders)
  const rowItemData = useMemo<RowItemData>(() => ({
    channels,
    focusedChannelIndex,
    favorites,
    buildProgramBlocks,
  }), [channels, focusedChannelIndex, favorites, buildProgramBlocks]);

  const totalWidth = timeToPx(timeRange.endMs);

  return (
    <div ref={containerRef} className={styles.epgGrid}>
      {/* Time Ruler */}
      <div className={styles.timeRulerContainer}>
        <div className={styles.channelHeaderSpacer} style={{ width: CHANNEL_COLUMN_WIDTH }} />
        <div 
          ref={timelineRef}
          className={styles.timeRuler}
          onScroll={handleTimelineScroll}
        >
          <div className={styles.timeRulerInner} style={{ width: totalWidth }}>
            {timeBlocks.map((block, idx) => (
              <div
                key={idx}
                className={styles.timeBlock}
                style={{ left: timeToPx(block.timeMs), width: TIME_BLOCK_WIDTH_PX }}
              >
                {block.label}
              </div>
            ))}
            {/* Now line */}
            <div
              className={styles.nowLine}
              style={{ left: timeToPx(nowMs) }}
            />
          </div>
        </div>
      </div>

      {/* Channel Rows (Virtualized) */}
      <div className={styles.gridBody}>
        <List
          ref={listRef}
          height={window.innerHeight - TIME_RULER_HEIGHT - 100}
          itemCount={channels.length}
          itemSize={CHANNEL_ROW_HEIGHT}
          width={window.innerWidth - 40}
          itemData={rowItemData}
        >
          {Row}
        </List>
      </div>
    </div>
  );
};

function formatTime(ms: number): string {
  const date = new Date(ms);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
