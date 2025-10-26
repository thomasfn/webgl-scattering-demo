import { vec4 } from "gl-matrix";
import { Category, Property, PropertyType } from "../rendering/external-properties";
import { BooleanPropertyControl } from "./property-controls/boolean";
import { NumberPropertyControl } from "./property-controls/number";
import { ColourPropertyControl } from "./property-controls/colour";
import { ControlPanel } from "./control-panel";

interface RendererControlPanelProps {
  category: Category;
  propertiesDefinitions: readonly [key: string, property: Property][];
  properties: Record<string, unknown>;
  onPropertyChanged: (propertyKey: string, newValue: unknown) => void;
}

function RendererControlPanel({
  category,
  propertiesDefinitions,
  properties,
  onPropertyChanged,
}: Readonly<RendererControlPanelProps>) {
  return (
    <ControlPanel title={category.name}>
      {propertiesDefinitions.map(([key, property]) => {
        switch (property.propertyType) {
          case PropertyType.Boolean:
            return (
              <div className="p-1" key={key}>
                <BooleanPropertyControl
                  name={property.name}
                  value={properties[key] as boolean}
                  onValueChanged={(newValue) => onPropertyChanged(key, newValue)}
                  tooltip={property.description}
                />
              </div>
            );
          case PropertyType.Number:
            return (
              <div className="p-1" key={key}>
                <NumberPropertyControl
                  name={property.name}
                  options={property}
                  value={properties[key] as number}
                  onValueChanged={(newValue) => onPropertyChanged(key, newValue)}
                  tooltip={property.description}
                />
              </div>
            );
          case PropertyType.Colour:
            return (
              <div className="p-1" key={key}>
                <ColourPropertyControl
                  name={property.name}
                  options={property}
                  value={properties[key] as vec4}
                  onValueChanged={(newValue) => onPropertyChanged(key, newValue)}
                  tooltip={property.description}
                />
              </div>
            );
        }
      })}
    </ControlPanel>
  );
}

export interface RendererControlsProps {
  propertiesDefinitions: Record<string, Property>;
  properties: Record<string, unknown>;
  onPropertiesChanged: (newProperties: Record<string, unknown>) => void;
}

export function RendererControls({
  propertiesDefinitions,
  properties,
  onPropertiesChanged,
}: Readonly<RendererControlsProps>) {
  function onPropertyChanged(propertyKey: string, newValue: unknown) {
    const newProperties = { ...properties, [propertyKey]: newValue };
    onPropertiesChanged(newProperties);
  }

  const groups: Record<string, [key: string, property: Property][]> = {};
  for (const pair of Object.entries(propertiesDefinitions)) {
    (groups[pair[1].category.name] ??= []).push(pair);
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      {Object.entries(groups).map(([categoryName, categoryProperties]) => (
        <RendererControlPanel
          key={categoryName}
          category={categoryProperties[0][1].category}
          propertiesDefinitions={categoryProperties}
          properties={properties}
          onPropertyChanged={onPropertyChanged}
        />
      ))}
    </div>
  );
}
