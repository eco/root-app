import { replaceBigInts, restoreBigInts, SerializedBigInt } from "../json";

describe("JSON BigInt utilities", () => {
  describe("replaceBigInts", () => {
    it("should convert BigInt to SerializedBigInt objects", () => {
      const original = 123456789n;
      const expected: SerializedBigInt = { type: "bigint", value: "123456789" };
      expect(replaceBigInts(original)).toEqual(expected);
    });

    it("should handle negative BigInt values", () => {
      const original = -123456789n;
      const expected: SerializedBigInt = { type: "bigint", value: "-123456789" };
      expect(replaceBigInts(original)).toEqual(expected);
    });

    it("should leave primitive values untouched", () => {
      expect(replaceBigInts(null)).toBeNull();
      expect(replaceBigInts(undefined)).toBeUndefined();
      expect(replaceBigInts(123)).toBe(123);
      expect(replaceBigInts("string")).toBe("string");
      expect(replaceBigInts(true)).toBe(true);
      expect(replaceBigInts(false)).toBe(false);
    });

    it("should recursively process objects", () => {
      const original = {
        id: 1,
        amount: 1000000000000000000n,
        details: {
          timestamp: 1691251200n,
          metadata: "test",
        },
      };

      const expected = {
        id: 1,
        amount: { type: "bigint", value: "1000000000000000000" },
        details: {
          timestamp: { type: "bigint", value: "1691251200" },
          metadata: "test",
        },
      };

      expect(replaceBigInts(original)).toEqual(expected);
    });

    it("should process arrays", () => {
      const original = [1, 2n, 3, 4n];
      const expected = [1, { type: "bigint", value: "2" }, 3, { type: "bigint", value: "4" }];
      expect(replaceBigInts(original)).toEqual(expected);
    });

    it("should handle nested arrays", () => {
      const original = [1, [2n, 3], 4n];
      const expected = [1, [{ type: "bigint", value: "2" }, 3], { type: "bigint", value: "4" }];
      expect(replaceBigInts(original)).toEqual(expected);
    });

    it("should handle complex nested structures", () => {
      const original = {
        id: 1,
        amounts: [10n, 20n, 30n],
        metadata: {
          created: 1691251200n,
          values: [
            { key: "a", value: 100n },
            { key: "b", value: 200n },
          ],
        },
      };

      const expected = {
        id: 1,
        amounts: [
          { type: "bigint", value: "10" },
          { type: "bigint", value: "20" },
          { type: "bigint", value: "30" },
        ],
        metadata: {
          created: { type: "bigint", value: "1691251200" },
          values: [
            { key: "a", value: { type: "bigint", value: "100" } },
            { key: "b", value: { type: "bigint", value: "200" } },
          ],
        },
      };

      expect(replaceBigInts(original)).toEqual(expected);
    });

    it("should be JSON.stringify compatible", () => {
      const original = {
        id: 1,
        amount: 1000000000000000000n,
        details: {
          timestamp: 1691251200n,
        },
      };

      const serialized = replaceBigInts(original);
      const jsonString = JSON.stringify(serialized);

      // Should not throw
      expect(() => JSON.parse(jsonString)).not.toThrow();

      // Should contain our serialized format
      expect(jsonString).toContain('"type":"bigint"');
      expect(jsonString).toContain('"value":"1000000000000000000"');
    });
  });

  describe("restoreBigInts", () => {
    it("should convert SerializedBigInt objects back to BigInt", () => {
      const serialized: SerializedBigInt = { type: "bigint", value: "123456789" };
      const expected = 123456789n;
      expect(restoreBigInts(serialized)).toEqual(expected);
    });

    it("should handle negative values", () => {
      const serialized: SerializedBigInt = { type: "bigint", value: "-123456789" };
      const expected = -123456789n;
      expect(restoreBigInts(serialized)).toEqual(expected);
    });

    it("should leave primitive values untouched", () => {
      expect(restoreBigInts(null)).toBeNull();
      expect(restoreBigInts(undefined)).toBeUndefined();
      expect(restoreBigInts(123)).toBe(123);
      expect(restoreBigInts("string")).toBe("string");
      expect(restoreBigInts(true)).toBe(true);
      expect(restoreBigInts(false)).toBe(false);
    });

    it("should recursively process objects", () => {
      const serialized = {
        id: 1,
        amount: { type: "bigint", value: "1000000000000000000" },
        details: {
          timestamp: { type: "bigint", value: "1691251200" },
          metadata: "test",
        },
      };

      const expected = {
        id: 1,
        amount: 1000000000000000000n,
        details: {
          timestamp: 1691251200n,
          metadata: "test",
        },
      };

      expect(restoreBigInts(serialized)).toEqual(expected);
    });

    it("should process arrays", () => {
      const serialized = [1, { type: "bigint", value: "2" }, 3, { type: "bigint", value: "4" }];
      const expected = [1, 2n, 3, 4n];
      expect(restoreBigInts(serialized)).toEqual(expected);
    });

    it("should handle nested arrays", () => {
      const serialized = [1, [{ type: "bigint", value: "2" }, 3], { type: "bigint", value: "4" }];
      const expected = [1, [2n, 3], 4n];
      expect(restoreBigInts(serialized)).toEqual(expected);
    });

    it("should handle complex nested structures", () => {
      const serialized = {
        id: 1,
        amounts: [
          { type: "bigint", value: "10" },
          { type: "bigint", value: "20" },
          { type: "bigint", value: "30" },
        ],
        metadata: {
          created: { type: "bigint", value: "1691251200" },
          values: [
            { key: "a", value: { type: "bigint", value: "100" } },
            { key: "b", value: { type: "bigint", value: "200" } },
          ],
        },
      };

      const expected = {
        id: 1,
        amounts: [10n, 20n, 30n],
        metadata: {
          created: 1691251200n,
          values: [
            { key: "a", value: 100n },
            { key: "b", value: 200n },
          ],
        },
      };

      expect(restoreBigInts(serialized)).toEqual(expected);
    });

    it("should ignore objects that don't match the SerializedBigInt structure", () => {
      const input = {
        id: 1,
        // Missing 'type' field
        notBigInt1: { value: "123" },
        // Wrong 'type' value
        notBigInt2: { type: "string", value: "123" },
        // Missing 'value' field
        notBigInt3: { type: "bigint" },
        // 'value' is not a string
        notBigInt4: { type: "bigint", value: 123 },
      };

      const expected = {
        id: 1,
        notBigInt1: { value: "123" },
        notBigInt2: { type: "string", value: "123" },
        notBigInt3: { type: "bigint" },
        notBigInt4: { type: "bigint", value: 123 },
      };

      expect(restoreBigInts(input)).toEqual(expected);
    });

    it("should handle invalid BigInt strings gracefully", () => {
      const input = {
        valid: { type: "bigint", value: "123" },
        invalid: { type: "bigint", value: "not-a-number" },
      };

      // When BigInt conversion fails, it should return the original object
      const result = restoreBigInts(input);
      expect(result.valid).toBe(123n);
      expect(result.invalid).toEqual({ type: "bigint", value: "not-a-number" });
    });
  });

  describe("round-trip serialization", () => {
    it("should successfully round-trip between BigInt and serialized format", () => {
      const original = {
        id: 1,
        amount: 1000000000000000000n,
        details: {
          timestamp: 1691251200n,
          values: [10n, 20n, 30n],
        },
      };

      // Serialize (BigInt -> SerializedBigInt)
      const serialized = replaceBigInts(original);

      // Convert to JSON and back
      const jsonString = JSON.stringify(serialized);
      const parsed = JSON.parse(jsonString);

      // Deserialize (SerializedBigInt -> BigInt)
      const restored = restoreBigInts(parsed);

      // Original and restored should be equal
      expect(restored).toEqual(original);
    });

    it("should preserve non-BigInt data during round-trip", () => {
      const original = {
        id: "user-123",
        name: "Test User",
        balance: 1000000000000000000n,
        isActive: true,
        tags: ["tag1", "tag2"],
        metadata: {
          createdAt: "2023-08-05T12:00:00Z",
          numericId: 12345,
        },
      };

      const serialized = replaceBigInts(original);
      const jsonString = JSON.stringify(serialized);
      const parsed = JSON.parse(jsonString);
      const restored = restoreBigInts(parsed);

      expect(restored).toEqual(original);
    });

    it("should handle empty objects and arrays", () => {
      const original = {
        emptyObject: {},
        emptyArray: [],
        nestedEmpty: {
          emptyObject: {},
          emptyArray: [],
        },
        value: 123n,
      };

      const serialized = replaceBigInts(original);
      const jsonString = JSON.stringify(serialized);
      const parsed = JSON.parse(jsonString);
      const restored = restoreBigInts(parsed);

      expect(restored).toEqual(original);
    });

    it("should handle large BigInt values", () => {
      // Test with values that exceed the max safe integer in JavaScript
      const original = {
        veryLarge: 9007199254740992n, // 2^53
        evenLarger: 18446744073709551615n, // 2^64 - 1
        negative: -9007199254740992n,
      };

      const serialized = replaceBigInts(original);
      const jsonString = JSON.stringify(serialized);
      const parsed = JSON.parse(jsonString);
      const restored = restoreBigInts(parsed);

      expect(restored).toEqual(original);
    });
  });
});
