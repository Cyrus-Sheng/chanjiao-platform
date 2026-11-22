import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export function Chart({ option, className = '' }: { option: any; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chart.current = echarts.init(ref.current);
    const observer = new ResizeObserver(() => chart.current?.resize());
    observer.observe(ref.current);
    return () => { observer.disconnect(); chart.current?.dispose(); };
  }, []);
  useEffect(() => { chart.current?.setOption(option, true); }, [option]);
  return <div ref={ref} className={`chart ${className}`} aria-label="数据图表" />;
}
