import { BasePropertyControl } from "./base";

export interface BooleanPropertyControlProps {
  name: string;
  value: boolean;
  onValueChanged: (newValue: boolean) => void;
  tooltip?: string;
  inline?: boolean;
}

export function BooleanPropertyControl({
  name,
  value,
  onValueChanged,
  tooltip,
  inline,
}: Readonly<BooleanPropertyControlProps>) {
  return (
    <BasePropertyControl name={name} tooltip={tooltip} inline={inline}>
      <input
        className="grow"
        type="checkbox"
        checked={value}
        onChange={(ev) => onValueChanged(ev.currentTarget.checked)}
      />
    </BasePropertyControl>
  );
}
