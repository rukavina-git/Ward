import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ProjectRootError } from "./find.js";
import {
  analyzeMustExist,
  stripCodeComment,
  type MustExistCheck,
  type MustExistReport,
} from "./must-exist.js";

// Hand-written projects in temp folders, plus the two fixtures (copied
// without build/). Never HO-01…HO-10.

const repo = path.resolve(import.meta.dirname, "../../..");
const temps: string[] = [];
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true });
});

function temp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "ward-must-exist-"));
  temps.push(d);
  return d;
}

function project(files: Record<string, string>): string {
  const d = temp();
  const all = {
    "settings.gradle.kts": 'include(":app")\n',
    "app/build.gradle.kts": 'plugins { id("com.android.application") }\n',
    "app/src/main/AndroidManifest.xml":
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application android:label="x" />\n</manifest>\n',
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    const abs = path.join(d, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  return d;
}

function copyFixture(name: string): string {
  const d = temp();
  cpSync(path.join(repo, "fixtures", name), d, {
    recursive: true,
    filter: (s) => !/[/\\]build([/\\]|$)/.test(s),
  });
  return d;
}

const of = (r: MustExistReport, check: MustExistCheck) => {
  const v = r.verdicts.find((x) => x.check === check);
  if (!v) throw new Error(`no ${check}`);
  return v;
};

const SRC = "app/src/main/java/a/";
const POLICY = `${SRC}About.kt`;
const policy = { [POLICY]: 'val url = "https://a.example/privacy"\n' };

describe("analyzeMustExist", () => {
  it("FAILs account deletion when sign-up has no delete path", async () => {
    const r = await analyzeMustExist(
      project({
        ...policy,
        [`${SRC}Auth.kt`]:
          'class Auth {\n    fun signUp(email: String) = api.post("users/register/", email)\n}\n',
      }),
    );
    const v = of(r, "account-deletion");
    expect(v.verdict).toBe("FAIL");
    expect(v.maswe).toEqual(["MASWE-0076"]);
    expect(v.evidence[0]).toMatchObject({
      file: `${SRC}Auth.kt`,
      line: 2,
      quote: 'fun signUp(email: String) = api.post("users/register/", email)',
    });
  });

  it("gives NO FINDING with sign-up and a delete-account string", async () => {
    const r = await analyzeMustExist(
      project({
        ...policy,
        [`${SRC}Auth.kt`]: "fun createAccount() {}\n",
        "app/src/main/res/values/strings.xml":
          '<resources>\n  <string name="delete">Delete my account</string>\n</resources>\n',
      }),
    );
    const v = of(r, "account-deletion");
    expect(v.verdict).toBe("NO FINDING");
    expect(v.evidence.map((e) => e.file)).toContain(
      "app/src/main/res/values/strings.xml",
    );
  });

  it("counts a link to a web deletion page", async () => {
    const r = await analyzeMustExist(
      project({
        ...policy,
        [`${SRC}Auth.kt`]:
          'fun register_user() = Unit\nfun createUserWithEmail() = Unit\nval DEL = "https://a.example/account/delete"\n',
      }),
    );
    expect(of(r, "account-deletion").verdict).toBe("NO FINDING");
    expect(of(r, "data-deletion-url").evidence[0]).toMatchObject({ line: 3 });
  });

  it("is MANUAL with no sign-up code", async () => {
    const r = await analyzeMustExist(
      project({ ...policy, [`${SRC}Main.kt`]: "fun main() = Unit\n" }),
    );
    expect(of(r, "account-deletion").verdict).toBe("MANUAL");
    expect(of(r, "data-deletion-url").verdict).toBe("MANUAL");
  });

  it("doesn't take EventBus.register or registerReceiver as sign-up", async () => {
    const r = await analyzeMustExist(
      project({
        ...policy,
        [`${SRC}Main.kt`]:
          "bus.register(this)\ncontext.registerReceiver(r, f)\nregisterForActivityResult(x)\n",
      }),
    );
    expect(of(r, "account-deletion").verdict).toBe("MANUAL");
  });

  it("ignores comments, test and debug source sets", async () => {
    const r = await analyzeMustExist(
      project({
        [`${SRC}Auth.kt`]:
          "fun signUp() = Unit // deleteAccount later\n/* deleteAccount */\n * deleteAccount\n// privacy policy\n",
        "app/src/test/java/a/T.kt": "fun deleteAccount() = Unit\n",
        "app/src/androidTest/java/a/T.kt": 'val p = "privacy policy"\n',
        "app/src/debug/java/a/D.kt": "fun deleteAccount() = Unit\n",
        "app/src/main/res/values/strings.xml":
          '<resources>\n  <!-- <string name="p">Privacy policy</string> -->\n</resources>\n',
      }),
    );
    expect(of(r, "account-deletion").verdict).toBe("FAIL");
    expect(of(r, "privacy-policy").verdict).toBe("FAIL");
    expect(r.scanned.files).toBe(2);
  });

  it("FAILs a missing privacy policy at the manifest's application line", async () => {
    const root = project({ [`${SRC}Main.kt`]: "fun main() = Unit\n" });
    const v = of(await analyzeMustExist(root), "privacy-policy");
    expect(v.verdict).toBe("FAIL");
    expect(v.maswe).toEqual(["MASWE-0072"]);
    const e = v.evidence[0];
    if (!e) throw new Error("no evidence");
    expect(e).toMatchObject({
      file: "app/src/main/AndroidManifest.xml",
      line: 2,
    });
    const lines = readFileSync(path.join(root, e.file), "utf8").split("\n");
    expect(lines[e.line - 1]).toContain(e.quote);
  });

  it("is MANUAL on a found privacy policy (Ward doesn't read it)", async () => {
    const r = await analyzeMustExist(
      project({
        "app/src/main/res/layout/about.xml":
          '<TextView android:text="@string/privacy_policy" />\n',
      }),
    );
    expect(of(r, "privacy-policy")).toMatchObject({
      verdict: "MANUAL",
      evidence: [{ file: "app/src/main/res/layout/about.xml", line: 1 }],
    });
  });

  it("rejects a bad root", async () => {
    await expect(analyzeMustExist("/no/such/ward/root")).rejects.toThrow(
      ProjectRootError,
    );
  });

  it("finds EA-23 in the example app and nothing in its clean twin", async () => {
    const bad = await analyzeMustExist(copyFixture("example-app"));
    const deletion = of(bad, "account-deletion");
    expect(deletion.verdict).toBe("FAIL");
    expect(deletion.evidence.map((e) => e.file)).toContain(
      "app/src/main/java/app/pennyjar/auth/AuthRepository.kt",
    );
    expect(of(bad, "privacy-policy").verdict).toBe("MANUAL");

    const clean = await analyzeMustExist(copyFixture("example-app-clean"));
    expect(of(clean, "account-deletion").verdict).toBe("NO FINDING");
    expect(of(clean, "privacy-policy").verdict).toBe("MANUAL");
  });
});

describe("stripCodeComment", () => {
  it("keeps URLs and drops trailing comments", () => {
    expect(stripCodeComment('val u = "https://a/b" // c')).toBe(
      'val u = "https://a/b" ',
    );
    expect(stripCodeComment("  // all comment")).toBe("  ");
  });
});
