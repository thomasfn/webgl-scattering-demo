import { vec4 } from "gl-matrix";

export const enum PropertyType {
  Boolean,
  Number,
  Colour,
  Option,
}

export interface Category {
  name: string;
  description: string;
}

export interface BaseProperty<TPropertyType extends PropertyType> {
  readonly propertyType: TPropertyType;
  readonly name: string;
  readonly category: Category;
  readonly description?: string;
}

export interface NumberPropertyOptions {
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly step?: number;
}

export function numberProperty(
  name: string,
  category: Category,
  options: NumberPropertyOptions,
  description?: string,
): BaseProperty<PropertyType.Number> & NumberPropertyOptions {
  return { propertyType: PropertyType.Number, name, category, ...options, description };
}

export interface ColourPropertyOptions {
  readonly linear: boolean;
  readonly alpha: boolean;
}

export function colourProperty(
  name: string,
  category: Category,
  options: ColourPropertyOptions,
  description?: string,
): BaseProperty<PropertyType.Colour> & ColourPropertyOptions {
  return { propertyType: PropertyType.Colour, name, category, ...options, description };
}

export interface OptionPropertyOptions {
  readonly options: readonly [value: number, name: string][];
}

export function optionProperty(
  name: string,
  category: Category,
  options: OptionPropertyOptions,
  description?: string,
): BaseProperty<PropertyType.Option> & OptionPropertyOptions {
  return { propertyType: PropertyType.Option, name, category, ...options, description };
}

export type Property =
  | BaseProperty<PropertyType.Boolean>
  | (BaseProperty<PropertyType.Number> & NumberPropertyOptions)
  | (BaseProperty<PropertyType.Colour> & ColourPropertyOptions)
  | (BaseProperty<PropertyType.Option> & OptionPropertyOptions);

export interface Properties {
  [key: string]: Property;
}

interface PropertyTypeToConcreteType {
  [PropertyType.Boolean]: boolean;
  [PropertyType.Number]: number;
  [PropertyType.Colour]: vec4;
  [PropertyType.Option]: number;
}

export type ConcreteProperties<TProperties extends Properties> = {
  [P in keyof TProperties]: PropertyTypeToConcreteType[TProperties[P]["propertyType"]];
};
