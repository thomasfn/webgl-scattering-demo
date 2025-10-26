import { ColourPropertyOptions } from "@/src/rendering/external-properties";
import { vec4 } from "gl-matrix";
import { NumberPropertyControl } from "./number";
import { useEffect, useRef } from "react";
import { BasePropertyControl } from "./base";

export interface ColourPropertyControlProps {
  name: string;
  options: ColourPropertyOptions;
  value: vec4;
  onValueChanged: (newValue: vec4) => void;
  tooltip?: string;
  inline?: boolean;
}

export function ColourPropertyControl({
  name,
  options,
  value,
  onValueChanged,
  tooltip,
  inline,
}: Readonly<ColourPropertyControlProps>) {
  const colourPreviewElement = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!colourPreviewElement.current) {
      return;
    }
    let colour = value;
    if (options.linear) {
      // The colour is in linear space, so gamma-correct it for display
      colour = [Math.pow(colour[0], 1.0 / 2.2), Math.pow(colour[1], 1.0 / 2.2), Math.pow(colour[2], 1.0 / 2.2)];
    }
    colourPreviewElement.current.style = `background-color: rgba(${colour[0] * 255.0}, ${colour[1] * 255.0}, ${colour[2] * 255.0}, 1.0)`;
  }, [value, colourPreviewElement, options]);
  return (
    <BasePropertyControl name={name} tooltip={tooltip} inline={inline}>
      <div className="flex flex-col grow">
        <div className="w-full h-2" ref={colourPreviewElement}></div>
        <NumberPropertyControl
          name="R"
          options={{ minValue: 0.0, maxValue: 1.0, step: 1.0 / 255.0 }}
          value={value[0]}
          onValueChanged={(r) => onValueChanged([r, value[1], value[2], value[3]])}
          inline
        />
        <NumberPropertyControl
          name="G"
          options={{ minValue: 0.0, maxValue: 1.0, step: 1.0 / 255.0 }}
          value={value[1]}
          onValueChanged={(g) => onValueChanged([value[0], g, value[2], value[3]])}
          inline
        />
        <NumberPropertyControl
          name="B"
          options={{ minValue: 0.0, maxValue: 1.0, step: 1.0 / 255.0 }}
          value={value[2]}
          onValueChanged={(b) => onValueChanged([value[0], value[1], b, value[3]])}
          inline
        />
        {options.alpha ? (
          <NumberPropertyControl
            name="A"
            options={{ minValue: 0.0, maxValue: 1.0, step: 1.0 / 255.0 }}
            value={value[3]}
            onValueChanged={(a) => onValueChanged([value[0], value[1], value[2], a])}
            inline
          />
        ) : undefined}
      </div>
    </BasePropertyControl>
  );
}
