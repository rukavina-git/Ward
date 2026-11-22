import { describe, expect, it } from "vitest";
import { stem, tokenize } from "./tokenize.js";

describe("tokenize", () => {
  it("keeps OWASP IDs whole, in any case and inside punctuation", () => {
    expect(
      tokenize("See (MASWE-0067), mastg-test-0039 and MASVS-Network-1."),
    ).toEqual([
      "see",
      "maswe-0067",
      "mastg-test-0039",
      "and",
      "masvs-network-1",
    ]);
    expect(tokenize("MASTG-DEMO-0001:")).toEqual(["mastg-demo-0001"]);
  });

  it("splits on anything that isn't a letter or digit, drops 1-letter tokens", () => {
    expect(tokenize('android:debuggable="true" in a build.gradle')).toEqual([
      "android",
      "debuggable",
      "true",
      "in",
      "build",
      "gradle",
    ]);
    expect(tokenize("setJavaScriptEnabled(true)")).toEqual([
      "setjavascriptenabled",
      "true",
    ]);
    expect(tokenize("TLS 1.2, Gson 2.8")).toEqual(["tls", "gson"]);
  });

  it("drops stopwords and stems only when asked", () => {
    const text = "The keys are stored in SharedPreferences";
    expect(tokenize(text)).toEqual([
      "the",
      "keys",
      "are",
      "stored",
      "in",
      "sharedpreferences",
    ]);
    expect(tokenize(text, { stopwords: true })).toEqual([
      "keys",
      "stored",
      "sharedpreferences",
    ]);
    expect(tokenize(text, { stopwords: true, stem: true })).toEqual([
      "key",
      "stor",
      "sharedpreference",
    ]);
  });

  it("never stems or drops IDs", () => {
    expect(
      tokenize("MASVS-STORAGE-1", { stem: true, stopwords: true }),
    ).toEqual(["masvs-storage-1"]);
  });

  it("handles empty and symbol-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize(" -- !! ")).toEqual([]);
  });
});

describe("stem", () => {
  it("cuts common endings", () => {
    expect(stem("policies")).toBe("policy");
    expect(stem("logging")).toBe("logg");
    expect(stem("logged")).toBe("logg");
    expect(stem("securely")).toBe("secure");
    expect(stem("permissions")).toBe("permission");
  });

  it("leaves short words, -ss, -us, -is and digits alone", () => {
    expect(stem("access")).toBe("access");
    expect(stem("status")).toBe("status");
    expect(stem("analysis")).toBe("analysis");
    expect(stem("uses")).toBe("use");
    expect(stem("is")).toBe("is");
    expect(stem("sha256s")).toBe("sha256s");
  });
});
