import * as Slider from '@radix-ui/react-slider';

export function LabeledSlider({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="slider-field"><span><b>{label}</b><strong>{value}{unit}</strong></span><Slider.Root className="slider-root" value={[value]} min={min} max={max} step={step} onValueChange={values => onChange(values[0])}><Slider.Track className="slider-track"><Slider.Range className="slider-range" /></Slider.Track><Slider.Thumb className="slider-thumb" aria-label={label} /></Slider.Root><small><span>{min}{unit}</span><span>{max}{unit}</span></small></label>;
}
