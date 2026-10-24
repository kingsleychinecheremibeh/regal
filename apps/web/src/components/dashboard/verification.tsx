"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { CaseStatus, useAction, useData } from "./context";
import { Badge, Field, Skeleton } from "./ui";

type Case = {
  kind: "kyc" | "kyb";
  status: CaseStatus;
  data: Record<string, unknown>;
  note: string | null;
  submittedAt: string | null;
};
type FileInfo = { name: string; type: string; size: number };

const KYC_STEPS = [
  ["document", "Identity document"],
  ["selfie", "Selfie check"],
  ["questionnaire", "Eligibility questionnaire"],
] as const;
const KYB_STEPS = [
  ["company", "Company details"],
  ["people", "Directors and owners"],
  ["documents", "Company documents"],
  ["profile", "Business profile"],
] as const;

const STATUS_NOTE: Record<CaseStatus, [string, string]> = {
  not_started: [
    "info",
    "Verify once to unlock trading, payments, accounts and cards.",
  ],
  in_review: [
    "info",
    "In review. Use the demo reviewer below to decide the case.",
  ],
  action_required: ["", "Action required. Update the steps and submit again."],
  rejected: [
    "err",
    "Not approved. Review the note, update the steps and resubmit.",
  ],
  verified: ["ok", "Verified. Limits and products are unlocked."],
};

function FilePick({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value?: FileInfo;
  onChange: (file: FileInfo) => void;
}) {
  return (
    <Field
      label={label}
      id={id}
      hint={
        value
          ? `Selected: ${value.name} (${Math.ceil(value.size / 1024)} KB). Only the name, type and size are recorded.`
          : "Demo only. Do not upload real documents. The file never leaves your browser."
      }
    >
      <div className="row">
        <input
          id={id}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              onChange({
                name: file.name.slice(0, 120),
                type: file.type || "application/octet-stream",
                size: file.size,
              });
          }}
        />
        <button
          type="button"
          className="btn btn-s btn-sm"
          onClick={() =>
            onChange({
              name: `sample-${id}.pdf`,
              type: "application/pdf",
              size: 184320,
            })
          }
        >
          Use sample file
        </button>
      </div>
    </Field>
  );
}

function KycForm({
  step,
  initial,
  onSave,
  pending,
}: {
  step: string;
  initial: Record<string, unknown>;
  onSave: (value: unknown) => void;
  pending: boolean;
}) {
  const [doc, setDoc] = useState({
    type: "passport",
    country: "",
    number: "",
    ...(initial as object),
  } as { type: string; country: string; number: string; file?: FileInfo });
  const [q, setQ] = useState({
    occupation: "",
    sourceOfFunds: "salary",
    purpose: "all",
    politicallyExposed: false,
    ...(initial as object),
  });
  if (step === "document")
    return (
      <>
        <Field label="Document type" id="k-type">
          <select
            id="k-type"
            value={doc.type}
            onChange={(e) => setDoc({ ...doc, type: e.target.value })}
          >
            <option value="passport">Passport</option>
            <option value="national_id">National ID card</option>
            <option value="drivers_licence">Driving licence</option>
          </select>
        </Field>
        <Field label="Issuing country" id="k-country">
          <input
            id="k-country"
            value={doc.country}
            onChange={(e) => setDoc({ ...doc, country: e.target.value })}
          />
        </Field>
        <Field
          label="Document number"
          id="k-num"
          hint="Use a made-up number. It is stored masked."
        >
          <input
            id="k-num"
            value={doc.number.startsWith("••••") ? "" : doc.number}
            placeholder={
              doc.number.startsWith("••••") ? doc.number : "A1234567"
            }
            onChange={(e) => setDoc({ ...doc, number: e.target.value })}
          />
        </Field>
        <FilePick
          id="k-file"
          label="Document image"
          value={doc.file}
          onChange={(file) => setDoc({ ...doc, file })}
        />
        <button
          className="btn btn-d"
          disabled={pending}
          onClick={() => onSave(doc)}
        >
          Save step
        </button>
      </>
    );
  if (step === "selfie")
    return (
      <>
        <p className="sm mut">
          A live platform would ask for a short selfie video and compare it with
          your document. The preview never uses your camera.
        </p>
        <button
          className="btn btn-d"
          disabled={pending}
          onClick={() => onSave({ method: "sample" })}
        >
          Use sample selfie
        </button>
      </>
    );
  return (
    <>
      <Field label="Occupation" id="k-occ">
        <input
          id="k-occ"
          value={q.occupation}
          onChange={(e) => setQ({ ...q, occupation: e.target.value })}
        />
      </Field>
      <Field label="Main source of funds" id="k-src">
        <select
          id="k-src"
          value={q.sourceOfFunds}
          onChange={(e) => setQ({ ...q, sourceOfFunds: e.target.value })}
        >
          <option value="salary">Salary</option>
          <option value="business">Business income</option>
          <option value="savings">Savings</option>
          <option value="investments">Investments</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="What will you use TurboXGlobal for?" id="k-purpose">
        <select
          id="k-purpose"
          value={q.purpose}
          onChange={(e) => setQ({ ...q, purpose: e.target.value })}
        >
          <option value="payments">Payments and transfers</option>
          <option value="trading">Trading digital assets</option>
          <option value="investing">Investing</option>
          <option value="all">All of these</option>
        </select>
      </Field>
      <label className="check mb">
        <input
          type="checkbox"
          checked={q.politicallyExposed}
          onChange={(e) => setQ({ ...q, politicallyExposed: e.target.checked })}
        />
        I hold, or have held, a prominent public position
      </label>
      <button
        className="btn btn-d"
        disabled={pending}
        onClick={() => onSave(q)}
      >
        Save step
      </button>
    </>
  );
}

type Person = { name: string; role: string; ownership: number };

function KybForm({
  step,
  initial,
  onSave,
  pending,
}: {
  step: string;
  initial: unknown;
  onSave: (value: unknown) => void;
  pending: boolean;
}) {
  const [company, setCompany] = useState({
    name: "",
    registrationNumber: "",
    country: "",
    incorporatedOn: "",
    address: "",
    ...(initial as object),
  });
  const [people, setPeople] = useState<Person[]>(
    Array.isArray(initial) && initial.length
      ? (initial as Person[])
      : [{ name: "", role: "director_owner", ownership: 100 }],
  );
  const [docs, setDocs] = useState<{
    incorporation?: FileInfo;
    address?: FileInfo;
  }>((initial as object) ?? {});
  const [profile, setProfile] = useState({
    industry: "",
    monthlyVolume: "10k_100k",
    sourceOfFunds: "",
    ...(initial as object),
  });
  const text = (key: keyof typeof company, label: string, type = "text") => (
    <Field label={label} id={`b-${key}`}>
      <input
        id={`b-${key}`}
        type={type}
        value={company[key]}
        onChange={(e) => setCompany({ ...company, [key]: e.target.value })}
      />
    </Field>
  );
  if (step === "company")
    return (
      <>
        {text("name", "Registered company name")}
        {text("registrationNumber", "Registration number")}
        {text("country", "Country of incorporation")}
        {text("incorporatedOn", "Date of incorporation", "date")}
        {text("address", "Registered address")}
        <button
          className="btn btn-d"
          disabled={pending}
          onClick={() => onSave(company)}
        >
          Save step
        </button>
      </>
    );
  if (step === "people")
    return (
      <>
        <p className="sm mut">
          List every director and anyone who owns 25% or more. Use made-up
          names.
        </p>
        {people.map((person, index) => (
          <div className="card pad flat mb" key={index}>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="grow">
                <Field label="Full name" id={`p-n-${index}`}>
                  <input
                    id={`p-n-${index}`}
                    value={person.name}
                    onChange={(e) =>
                      setPeople(
                        people.map((p, i) =>
                          i === index ? { ...p, name: e.target.value } : p,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
              <Field label="Role" id={`p-r-${index}`}>
                <select
                  id={`p-r-${index}`}
                  value={person.role}
                  onChange={(e) =>
                    setPeople(
                      people.map((p, i) =>
                        i === index ? { ...p, role: e.target.value } : p,
                      ),
                    )
                  }
                >
                  <option value="director">Director</option>
                  <option value="owner">Owner</option>
                  <option value="director_owner">Director and owner</option>
                </select>
              </Field>
              <Field label="Ownership %" id={`p-o-${index}`}>
                <input
                  id={`p-o-${index}`}
                  inputMode="decimal"
                  style={{ width: 90 }}
                  value={person.ownership}
                  onChange={(e) =>
                    setPeople(
                      people.map((p, i) =>
                        i === index
                          ? { ...p, ownership: Number(e.target.value) || 0 }
                          : p,
                      ),
                    )
                  }
                />
              </Field>
            </div>
            {people.length > 1 && (
              <button
                className="btn btn-s btn-sm"
                onClick={() => setPeople(people.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <div className="row">
          <button
            className="btn btn-s"
            disabled={people.length >= 8}
            onClick={() =>
              setPeople([
                ...people,
                { name: "", role: "director", ownership: 0 },
              ])
            }
          >
            Add person
          </button>
          <button
            className="btn btn-d"
            disabled={pending}
            onClick={() => onSave(people)}
          >
            Save step
          </button>
        </div>
      </>
    );
  if (step === "documents")
    return (
      <>
        <FilePick
          id="b-inc"
          label="Certificate of incorporation"
          value={docs.incorporation}
          onChange={(file) => setDocs({ ...docs, incorporation: file })}
        />
        <FilePick
          id="b-addr"
          label="Proof of business address"
          value={docs.address}
          onChange={(file) => setDocs({ ...docs, address: file })}
        />
        <button
          className="btn btn-d"
          disabled={pending}
          onClick={() => onSave(docs)}
        >
          Save step
        </button>
      </>
    );
  return (
    <>
      <Field label="Industry" id="b-ind">
        <input
          id="b-ind"
          value={profile.industry}
          onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
        />
      </Field>
      <Field label="Expected monthly volume" id="b-vol">
        <select
          id="b-vol"
          value={profile.monthlyVolume}
          onChange={(e) =>
            setProfile({ ...profile, monthlyVolume: e.target.value })
          }
        >
          <option value="under_10k">Under 10,000 USD</option>
          <option value="10k_100k">10,000 to 100,000 USD</option>
          <option value="100k_1m">100,000 USD to 1 million USD</option>
          <option value="over_1m">Over 1 million USD</option>
        </select>
      </Field>
      <Field label="Source of funds" id="b-src">
        <input
          id="b-src"
          value={profile.sourceOfFunds}
          onChange={(e) =>
            setProfile({ ...profile, sourceOfFunds: e.target.value })
          }
        />
      </Field>
      <button
        className="btn btn-d"
        disabled={pending}
        onClick={() => onSave(profile)}
      >
        Save step
      </button>
    </>
  );
}

function CaseFlow({ value }: { value: Case }) {
  const steps = value.kind === "kyc" ? KYC_STEPS : KYB_STEPS;
  const locked = value.status === "in_review" || value.status === "verified";
  const firstOpen =
    steps.find(([key]) => !(key in value.data))?.[0] ?? steps[0][0];
  const [open, setOpen] = useState<string>(firstOpen);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const { pending, run } = useAction();
  const label =
    value.kind === "kyc"
      ? "Identity verification (KYC)"
      : "Business verification (KYB)";
  const [tone, message] = STATUS_NOTE[value.status];

  async function save(step: string, body: unknown) {
    setError("");
    const result = await run(
      () =>
        api(`demo/verification/${value.kind}/${step}`, { method: "PUT", body }),
      { success: "Step saved.", onError: setError },
    );
    if (result) {
      const next = steps.find(([key]) => key !== step && !(key in value.data));
      if (next) setOpen(next[0]);
    }
  }

  async function decide(decision: "verified" | "action_required" | "rejected") {
    setError("");
    await run(
      () =>
        api(`demo/verification/${value.kind}/review`, {
          body: { decision, ...(note ? { note } : {}) },
        }),
      {
        success:
          decision === "verified"
            ? value.kind === "kyc"
              ? "Approved. Demo funds have been credited."
              : "Business approved. Fiat Acquiring is unlocked."
            : "Decision recorded.",
        onError: setError,
      },
    );
    setNote("");
  }

  return (
    <div className="card pad mb">
      <div className="row sp mb">
        <h3 className="m0">{label}</h3>
        <Badge status={value.status} />
      </div>
      <div className={`notice ${tone}`}>
        {message}
        {value.note && (
          <>
            <br />
            <b>Reviewer note:</b> {value.note}
          </>
        )}
        {value.submittedAt && (
          <div className="xs mut">Submitted {dateTime(value.submittedAt)}</div>
        )}
      </div>
      <div style={{ maxWidth: 620 }}>
        {steps.map(([key, title], index) => {
          const done = key in value.data;
          const state = locked
            ? value.status === "verified"
              ? "done"
              : "rev"
            : done
              ? "done"
              : open === key
                ? "cur"
                : "";
          return (
            <div key={key}>
              <div className={`step ${state}`}>
                <i>{state === "done" ? "✓" : index + 1}</i>
                <div className="grow">
                  <b>{title}</b>
                  <div className="xs mut">
                    {locked
                      ? value.status === "verified"
                        ? "Complete"
                        : "Under review"
                      : done
                        ? "Complete"
                        : "Needs your input"}
                  </div>
                </div>
                {!locked && open !== key && (
                  <button
                    className="btn btn-s btn-sm"
                    onClick={() => setOpen(key)}
                  >
                    {done ? "Edit" : "Start"}
                  </button>
                )}
              </div>
              {!locked && open === key && (
                <div style={{ padding: "4px 0 12px 38px" }}>
                  {value.kind === "kyc" ? (
                    <KycForm
                      key={key}
                      step={key}
                      initial={
                        (value.data[key] as Record<string, unknown>) ?? {}
                      }
                      onSave={(body) => save(key, body)}
                      pending={pending}
                    />
                  ) : (
                    <KybForm
                      key={key}
                      step={key}
                      initial={value.data[key]}
                      onSave={(body) => save(key, body)}
                      pending={pending}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
        <p className="err-t" role="alert">
          {error}
        </p>
        {!locked && (
          <button
            className="btn btn-p"
            disabled={pending || steps.some(([key]) => !(key in value.data))}
            onClick={() =>
              run(
                () =>
                  api(`demo/verification/${value.kind}/submit`, {
                    method: "POST",
                  }),
                {
                  success: "Submitted for review.",
                  onError: setError,
                },
              )
            }
          >
            Submit for review
          </button>
        )}
      </div>
      {value.status === "in_review" && (
        <div className="card pad demo-ctl mt">
          <div className="row sp">
            <b>Demo reviewer</b>
            <span className="badge b-gold">Investor demo control</span>
          </div>
          <p className="sm mut">
            In production a compliance analyst or a verification provider makes
            this decision. Here you can play the reviewer to show each outcome.
          </p>
          <Field
            label="Note to the customer (needed to request info or reject)"
            id={`note-${value.kind}`}
          >
            <input
              id={`note-${value.kind}`}
              value={note}
              maxLength={300}
              placeholder="The ID image was unreadable. Upload a clear photo."
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <div className="row">
            <button
              className="btn btn-p"
              disabled={pending}
              onClick={() => decide("verified")}
            >
              Approve
            </button>
            <button
              className="btn btn-s"
              disabled={pending}
              onClick={() => decide("action_required")}
            >
              Request more info
            </button>
            <button
              className="btn btn-x"
              disabled={pending}
              onClick={() => decide("rejected")}
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Verification() {
  const { data } = useData<{ kyc: Case | null; kyb: Case | null }>(
    "demo/verification",
  );
  if (!data) return <Skeleton />;
  return (
    <>
      {data.kyc && <CaseFlow key={`kyc-${data.kyc.status}`} value={data.kyc} />}
      {data.kyb && <CaseFlow key={`kyb-${data.kyb.status}`} value={data.kyb} />}
    </>
  );
}
