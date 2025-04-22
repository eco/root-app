/**
 * Type that represents a value that can be safely JSON serialized
 * (with BigInt converted to a serializable object)
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
 * Represents a serialized BigInt value that can be safely included in JSON
 */
export interface SerializedBigInt {
  type: "bigint";
  value: string;
}

/**
 * Type that converts all BigInt values to SerializedBigInt objects in a given type
 */
export type WithBigIntSerialized<T> = T extends bigint
  ? SerializedBigInt
  : T extends Array<infer U>
    ? Array<WithBigIntSerialized<U>>
    : T extends object
      ? { [K in keyof T]: WithBigIntSerialized<T[K]> }
      : T;

/**
 * Type that converts all SerializedBigInt objects back to BigInt in a given type
 */
export type WithBigIntDeserialized<T> = T extends SerializedBigInt
  ? bigint
  : T extends Array<infer U>
    ? Array<WithBigIntDeserialized<U>>
    : T extends object
      ? { [K in keyof T]: WithBigIntDeserialized<T[K]> }
      : T;

/**
 * Checks if a value is a SerializedBigInt object
 */
function isSerializedBigInt(value: unknown): value is SerializedBigInt {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "value" in value &&
    (value as SerializedBigInt).type === "bigint" &&
    typeof (value as SerializedBigInt).value === "string"
  );
}

/**
 * Recursively converts BigInt values in an object to SerializedBigInt objects for JSON serialization
 * while preserving the structure and type information of the original object.
 *
 * @template T The type of the input object
 * @param obj - The object to process, potentially containing BigInt values
 * @returns The same object structure with all BigInt values converted to SerializedBigInt objects
 */
export function replaceBigInts<T>(obj: T): WithBigIntSerialized<T> {
  if (obj === null || obj === undefined) {
    return obj as WithBigIntSerialized<T>;
  }

  if (typeof obj === "bigint") {
    // Convert BigInt to a structured object
    return {
      type: "bigint",
      value: obj.toString(),
    } as WithBigIntSerialized<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map(replaceBigInts) as WithBigIntSerialized<T>;
  }

  if (typeof obj === "object") {
    const result = {} as Record<string, unknown>;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = replaceBigInts((obj as Record<string, unknown>)[key]);
      }
    }
    return result as WithBigIntSerialized<T>;
  }

  return obj as WithBigIntSerialized<T>;
}

/**
 * Recursively restores SerializedBigInt objects back to actual BigInt values
 *
 * @template T The type of the input object
 * @param obj - The object to process, potentially containing SerializedBigInt objects
 * @returns The same object structure with SerializedBigInt objects converted back to BigInt
 */
export function restoreBigInts<T>(obj: WithBigIntSerialized<T>): WithBigIntDeserialized<T> {
  if (obj === null || obj === undefined) {
    return obj as WithBigIntDeserialized<T>;
  }

  // Check if it's a SerializedBigInt object
  if (isSerializedBigInt(obj)) {
    try {
      return BigInt(obj.value) as WithBigIntDeserialized<T>;
    } catch {
      // If BigInt conversion fails, return the original object
      return obj as unknown as WithBigIntDeserialized<T>;
    }
  }

  if (Array.isArray(obj)) {
    return obj.map(restoreBigInts) as WithBigIntDeserialized<T>;
  }

  if (typeof obj === "object") {
    const result = {} as Record<string, unknown>;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = restoreBigInts((obj as Record<string, unknown>)[key]);
      }
    }
    return result as WithBigIntDeserialized<T>;
  }

  return obj as WithBigIntDeserialized<T>;
}
