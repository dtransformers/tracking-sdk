import {
  parseAttributionParams,
  extractClickIds,
  persistAttribution,
  getStoredAttribution,
} from "../../src/utils/attribution";

describe("Attribution Utils", () => {
  describe("parseAttributionParams", () => {
    it("should extract UTM parameters and map them to acquisition fields", () => {
      const qs = "?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale&utm_term=shoes&utm_content=banner";
      const result = parseAttributionParams(qs);

      expect(result).toMatchObject({
        acquisition_source: "google",
        acquisition_medium: "cpc",
        acquisition_campaign: "summer_sale",
        campaign_term: "shoes",
        campaign_content: "banner",
      });
    });

    it("should extract platform click IDs", () => {
      const qs = "?gclid=12345&fbclid=abcde&unknown=ignored";
      const result = parseAttributionParams(qs);

      expect(result).toEqual({
        gclid: "12345",
        fbclid: "abcde",
      });
    });

    it("should prefer explicit acquisition params over UTMs if both exist", () => {
      const qs = "?utm_source=fallback&acquisition_source=primary";
      const result = parseAttributionParams(qs);

      expect(result).toMatchObject({
        acquisition_source: "primary",
      });
    });

    it("should return empty object for empty query string", () => {
      expect(parseAttributionParams("")).toEqual({});
      expect(parseAttributionParams("?")).toEqual({});
    });
  });

  describe("extractClickIds", () => {
    it("should isolate click IDs from full attribution data", () => {
      const search = "?acquisition_source=google&gclid=g123&fbclid=f123&campaign_id=c123";

      const result = extractClickIds(search);
      expect(result).toEqual({
        gclid: "g123",
        fbclid: "f123",
      });
    });

    it("should return empty object if no click IDs present", () => {
      const search = "?acquisition_source=google";
      expect(extractClickIds(search)).toEqual({});
    });
  });

  describe("persistAttribution", () => {
    let mockStorage: any;

    beforeEach(() => {
      mockStorage = {
        setLocal: jest.fn(),
        getLocal: jest.fn(),
        setSession: jest.fn(),
        getSession: jest.fn(),
      };
    });

    it("should persist valid data to both local and session storage", () => {
      const data = {
        acquisition_source: "google",
        gclid: "123",
        fbclid: "abc",
        campaign_id: "c1",
      };

      persistAttribution(data, mockStorage);

      expect(mockStorage.setLocal).toHaveBeenCalledWith("__tk_attribution", data);
      expect(mockStorage.setSession).toHaveBeenCalledWith("__tk_attribution", data);
    });

    it("should not persist empty attribution data", () => {
      const data = {
        acquisition_source: undefined,
      };

      persistAttribution(data, mockStorage);

      expect(mockStorage.setLocal).not.toHaveBeenCalled();
      expect(mockStorage.setSession).not.toHaveBeenCalled();
    });
  });

  describe("getStoredAttribution", () => {
    let mockStorage: any;

    beforeEach(() => {
      mockStorage = {
        setLocal: jest.fn(),
        getLocal: jest.fn(),
        setSession: jest.fn(),
        getSession: jest.fn(),
      };
    });

    it("should return local storage data preferentially", () => {
      mockStorage.getLocal.mockReturnValue({ acquisition_source: "local" });
      mockStorage.getSession.mockReturnValue({ acquisition_source: "session" });

      const data = getStoredAttribution(mockStorage);
      expect(data).toEqual({ acquisition_source: "local" });
    });

    it("should return session data if local data is missing", () => {
      mockStorage.getLocal.mockReturnValue(null);
      mockStorage.getSession.mockReturnValue({ acquisition_source: "session" });

      const data = getStoredAttribution(mockStorage);
      expect(data).toEqual({ acquisition_source: "session" });
    });

    it("should return empty object if nothing is stored", () => {
      mockStorage.getLocal.mockReturnValue(null);
      mockStorage.getSession.mockReturnValue(null);

      const data = getStoredAttribution(mockStorage);
      expect(data).toEqual({});
    });
  });
});
