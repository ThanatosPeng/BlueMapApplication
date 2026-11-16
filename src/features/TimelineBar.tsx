import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Slider, Typography } from "antd";
import { CaretRightOutlined, PauseOutlined, CloseOutlined } from "@ant-design/icons";
import { useAppStore } from "../store/useAppStore";
import { litIdsAt, progressAtTime, timeAtProgress, timelineRange } from "../domain/timeline";

const STEPS = 80;

export function TimelineBar() {
  const open = useAppStore((s) => s.timelineOpen);
  const replayAt = useAppStore((s) => s.replayAt);
  const setReplayAt = useAppStore((s) => s.setReplayAt);
  const closeTimeline = useAppStore((s) => s.closeTimeline);
  const progress = useAppStore((s) => s.progress);

  const range = useMemo(() => timelineRange(progress.nodes), [progress.nodes]);
  const [playing, setPlaying] = useState(false);
  const atRef = useRef(replayAt);
  atRef.current = replayAt;

  // 播放：按固定步数推进；到末尾自动停
  useEffect(() => {
    if (!playing || !range) return;
    const step = (range.end - range.start) / STEPS;
    const timer = setInterval(() => {
      const next = Math.min(range.end, (atRef.current ?? range.start) + step);
      setReplayAt(next);
      if (next >= range.end) setPlaying(false);
    }, 90);
    return () => clearInterval(timer);
  }, [playing, range, setReplayAt]);

  if (!open) return null;

  if (!range) {
    return (
      <div className="bm-timeline">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          至少点亮两个节点才能回放。当前进度还不够。
        </Typography.Text>
        <Button size="small" type="text" icon={<CloseOutlined />} onClick={closeTimeline} />
      </div>
    );
  }

  const at = replayAt ?? range.start;
  const lit = litIdsAt(progress.nodes, at).size;
  const pct = Math.round(progressAtTime(range, at) * 100);

  return (
    <div className="bm-timeline">
      <Button
        size="small"
        type="text"
        icon={playing ? <PauseOutlined /> : <CaretRightOutlined />}
        onClick={() => {
          if (playing) return setPlaying(false);
          if (at >= range.end) setReplayAt(range.start);
          setPlaying(true);
        }}
        aria-label={playing ? "暂停" : "播放"}
      />
      <Slider
        style={{ flex: 1, margin: "0 10px" }}
        min={range.start}
        max={range.end}
        value={at}
        tooltip={{ formatter: (v) => new Date(Number(v)).toLocaleDateString("zh-CN") }}
        onChange={(v) => {
          setPlaying(false);
          setReplayAt(Number(v));
        }}
      />
      <Typography.Text style={{ fontSize: 11.5, color: "#a9bbd4", whiteSpace: "nowrap" }}>
        {new Date(at).toLocaleDateString("zh-CN")} · 已点亮 {lit} · {pct}%
      </Typography.Text>
      <Button
        size="small"
        type="text"
        icon={<CloseOutlined />}
        onClick={closeTimeline}
        aria-label="关闭时间轴"
        style={{ marginLeft: 6 }}
      />
    </div>
  );
}
