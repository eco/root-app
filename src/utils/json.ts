/**
 * Type that represents a value that can be safely JSON serialized
 * (with BigInt converted to string)
 */
export type JsonSerializable =
  | null
  | undefined
  | string
  | number
  | boolean
  | JsonSerializableObject
  | JsonSerializableArray;

// Type for objects that can be serialized
export interface JsonSerializableObject {
  [key: string]: JsonSerializable;
}

// Type for arrays that can be serialized
export type JsonSerializableArray = JsonSerializable[];

/**
 * Type that converts all BigInt values to string in a given type
 * This preserves the structure of the original type but replaces BigInt with string
 */
export type WithBigIntAsString<T> = T extends bigint
  ? string
  : T extends Array<infer U>
    ? Array<WithBigIntAsString<U>>
    : T extends object
      ? { [K in keyof T]: WithBigIntAsString<T[K]> }
      : T;

/**
 * Recursively converts BigInt values in an object to strings for JSON serialization
 * while preserving the structure and type information of the original object
 *
 * @template T The type of the input object
 * @param obj - The object to process, potentially containing BigInt values
 * @returns The same object structure with all BigInt values converted to strings
 */
export function replaceBigInts<T>(obj: T): WithBigIntAsString<T> {
  if (obj === null || obj === undefined) {
    return obj as WithBigIntAsString<T>;
  }

  if (typeof obj === "bigint") {
    return obj.toString() as WithBigIntAsString<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map(replaceBigInts) as WithBigIntAsString<T>;
  }

  if (typeof obj === "object") {
    const result = {} as Record<string, unknown>;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = replaceBigInts((obj as Record<string, unknown>)[key]);
      }
    }
    return result as WithBigIntAsString<T>;
  }

  return obj as WithBigIntAsString<T>;
}
