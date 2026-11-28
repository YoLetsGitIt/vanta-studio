'use client';

// Placeholders shaped like the schedule on a phone while it loads, so nothing jumps when
// the bookings arrive: the List view's cards, a Day or Week calendar's columns, and (while
// the studio itself is still loading) the whole page. Purely visual: one status for screen
// readers says it's loading.
import styles from './ScheduleSkeleton.module.css';

const Bone = ({ className = '', style }) => <span className={`skeleton ${styles.bone} ${className}`} style={style} aria-hidden="true" />;

export function ScheduleListSkeleton({ count = 3 }) {
  return (
    <div className={styles.list} role="status" aria-label="Loading bookings">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.card} aria-hidden="true">
          <span className={styles.times}><Bone className={styles.time} /><Bone className={styles.timeEnd} /></span>
          <Bone className={styles.bar} />
          <span className={styles.info}>
            <Bone className={styles.name} style={{ width: `${[62, 48, 56][i % 3]}%` }} />
            <Bone className={styles.what} style={{ width: `${[78, 66, 72][i % 3]}%` }} />
            <span className={styles.who}><Bone className={styles.face} /><Bone className={styles.whoName} /></span>
          </span>
        </div>
      ))}
    </div>
  );
}

// A calendar's frame: the column headings (an artist, or a day) over the hours, with a few
// soft blocks where bookings might be.
export function ScheduleCalendarSkeleton({ kind = 'day', columns = 2 }) {
  const cols = Array.from({ length: columns }, (_, i) => i);
  const blocks = [[0, 1.2, 1.5], [1, 3, 1], [0, 4.4, 2], [2, 2, 1.5]].filter(([col]) => col < columns);
  return (
    <div className={styles.calendar} style={{ '--cols': columns }} role="status" aria-label="Loading the schedule">
      <div className={styles.heads} aria-hidden="true">
        <span className={styles.corner} />
        {cols.map(i => (
          <span key={i} className={styles.head}>
            {kind === 'day'
              ? <><Bone className={styles.face} /><Bone className={styles.headName} /></>
              : <span className={styles.headDay}><Bone className={styles.headSmall} /><Bone className={styles.headDate} /></span>}
          </span>
        ))}
      </div>
      <div className={styles.hours} aria-hidden="true">
        <span className={styles.gutter}>{[1, 2, 3, 4, 5, 6].map(h => <Bone key={h} className={styles.hourLabel} style={{ top: `calc(${h} * var(--hour))` }} />)}</span>
        {cols.map(i => <span key={i} className={styles.col} />)}
        {blocks.map(([col, at, len], i) => (
          <Bone key={i} className={styles.block} style={{ left: `calc(44px + (100% - 44px) / ${columns} * ${col} + 4px)`, width: `calc((100% - 44px) / ${columns} - 8px)`, top: `calc(${at} * var(--hour))`, height: `calc(${len} * var(--hour) - 4px)` }} />
        ))}
      </div>
    </div>
  );
}

// The schedule page before the studio has loaded: its heading, the week of dates, the
// artists, then the day's bookings.
export function ScheduleBootSkeleton() {
  return (
    <div className={styles.boot} role="status" aria-label="Loading the schedule">
      <div aria-hidden="true">
        <div className={styles.bootHead}><span className={styles.bootTitle}><Bone className={styles.weekday} /><Bone className={styles.date} /></span></div>
        <div className={styles.strip}>
          {Array.from({ length: 7 }, (_, i) => <span key={i} className={styles.stripDay}><Bone className={styles.stripLetter} /><Bone className={styles.stripNum} /></span>)}
        </div>
        <div className={styles.chips}>{[84, 92, 80, 88].map((w, i) => <Bone key={i} className={styles.chip} style={{ width: w }} />)}</div>
      </div>
      <div className={styles.bootBody} aria-hidden="true"><ScheduleListSkeleton /></div>
    </div>
  );
}
