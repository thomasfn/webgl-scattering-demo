import { NumberPropertyOptions } from "@/src/rendering/external-properties";
import { BasePropertyControl } from "./base";

export interface NumberPropertyControlProps {
  name: string;
  options: NumberPropertyOptions;
  value: number;
  onValueChanged: (newValue: number) => void;
  tooltip?: string;
  inline?: boolean;
}

export function NumberPropertyControl({
  name,
  options,
  value,
  onValueChanged,
  tooltip,
  inline,
}: Readonly<NumberPropertyControlProps>) {
  return (
    <BasePropertyControl name={name} tooltip={tooltip} inline={inline}>
      <div className="flex flex-row grow gap-1">
        {options.step != null ? (
          <input
            className="grow"
            type="range"
            min={options.minValue}
            max={options.maxValue}
            step={options.step}
            value={value}
            onChange={(ev) => onValueChanged(parseFloat(ev.currentTarget.value))}
          />
        ) : (
          <input
            className="grow"
            type="number"
            min={options.minValue}
            max={options.maxValue}
            value={value}
            onChange={(ev) => onValueChanged(parseFloat(ev.currentTarget.value))}
          />
        )}
        <span>{value.toFixed(2)}</span>
      </div>
    </BasePropertyControl>
  );
}
