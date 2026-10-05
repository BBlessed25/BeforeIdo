import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { cn } from "../lib/utils";
import {
  SINGLES_AGES,
  SINGLES_GENDERS,
  SINGLES_ATTENDANCE,
  SINGLES_EXPECTATIONS,
  SINGLES_DIETARY,
  SINGLES_FUTURE,
  SINGLES_SUCCESS,
  validateSingles,
} from "../lib/singles";
import { submitSingles } from "../lib/submitSingles";

const STEPS = [
  { field: "fullName", title: "Full Name", type: "text", autoComplete: "name", required: true },
  { field: "phone", title: "Phone Number", type: "tel", autoComplete: "tel", required: true },
  { field: "email", title: "Email Address", type: "email", autoComplete: "email", required: true },
  { field: "ageRange", title: "Age Range", options: SINGLES_AGES, required: true },
  { field: "gender", title: "Gender", options: SINGLES_GENDERS, required: true },
  {
    field: "attendance",
    title: "Are you a member/regular attendee of Gospel Pillars Church?",
    options: SINGLES_ATTENDANCE,
  },
  {
    field: "expectations",
    title: "What are you hoping to get out of the event?",
    options: SINGLES_EXPECTATIONS,
    multiple: true,
  },
  {
    field: "dietary",
    title: "Do you have any dietary restrictions or allergies?",
    options: SINGLES_DIETARY,
  },
  {
    field: "futureEvents",
    title: "Would you like to hear about future Singles events?",
    options: SINGLES_FUTURE,
  },
];

function newForm() {
  return {
    submissionId: crypto.randomUUID(),
    fullName: "",
    phone: "",
    email: "",
    ageRange: "",
    gender: "",
    attendance: "",
    expectations: [],
    dietary: "",
    dietaryDetails: "",
    futureEvents: "",
  };
}

export function SinglesWizard() {
  const [form, setForm] = useState(newForm);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const headingRef = useRef(null);
  const submittingRef = useRef(false);
  const step = STEPS[stepIndex];
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const inputClass =
    "block w-full rounded-xl border-2 border-rose-200 bg-blush-50 px-4 py-3.5 text-lg text-text shadow-sm placeholder:text-neutral-700 focus:border-rose-600 focus:ring-2 focus:ring-rose-400/45";

  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex, saved]);

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "dietary" && value !== SINGLES_DIETARY[1] ? { dietaryDetails: "" } : {}),
    }));
    setErrors({});
    setError("");
  };

  const continueForm = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const validation = validateSingles(form);
    const relevant = [step.field, ...(step.field === "dietary" ? ["dietaryDetails"] : [])];
    const firstError = relevant.find((field) => validation.errors[field]);
    if (firstError) {
      setErrors(validation.errors);
      document.getElementById(firstError)?.focus();
      return;
    }
    if (stepIndex < STEPS.length - 1) {
      setErrors({});
      setError("");
      setStepIndex(stepIndex + 1);
      return;
    }
    if (Object.keys(validation.errors).length) {
      setErrors(validation.errors);
      const index = STEPS.findIndex(
        ({ field }) =>
          validation.errors[field] || (field === "dietary" && validation.errors.dietaryDetails)
      );
      if (index >= 0) setStepIndex(index);
      else setError(validation.errors.submissionId || "Please check your answers.");
      return;
    }
    submittingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await submitSingles(validation.value);
      setSaved(true);
    } catch (submissionError) {
      setError(submissionError.message || "We could not save your registration. Please retry.");
      if (submissionError.errors) {
        setErrors(submissionError.errors);
        const index = STEPS.findIndex(
          ({ field }) =>
            submissionError.errors[field] ||
            (field === "dietary" && submissionError.errors.dietaryDetails)
        );
        if (index >= 0) setStepIndex(index);
      }
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  if (saved)
    return (
      <Card className="singles-card wizard-card overflow-hidden">
        <CardContent className="px-6 py-10 text-center sm:px-10 sm:py-14">
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-burgundy-800 text-2xl text-blush-50"
            aria-hidden="true"
          >
            ✓
          </div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold text-burgundy-950 sm:text-3xl"
          >
            Registration complete
          </h2>
          <p className="mt-4 text-base leading-relaxed sm:text-lg">{SINGLES_SUCCESS}</p>
          <p className="mt-6 break-all text-sm text-burgundy-900">
            Submission ID: <span className="font-mono">{form.submissionId}</span>
          </p>
        </CardContent>
      </Card>
    );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="mb-4 text-center text-lg font-semibold text-blush-50">
        💕 Singles Event Registration
      </h2>
      <div className="mb-4 flex justify-between gap-4 text-sm font-medium text-blush-50 drop-shadow">
        <span>
          Question {stepIndex + 1} of {STEPS.length}
        </span>
        <span>{progress}%</span>
      </div>
      <div
        className="mb-6 h-2 overflow-hidden rounded-full bg-blush-50/30"
        role="progressbar"
        aria-label="Registration progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="h-full rounded-full bg-rose-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <Card key={step.field} className="singles-card wizard-card overflow-hidden">
        <CardContent className="p-6 sm:p-10">
          <form onSubmit={continueForm} noValidate aria-busy={saving}>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em] text-burgundy-700">
              {stepIndex + 1} →
            </p>
            <h3
              id="singles-question"
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl leading-tight font-bold text-burgundy-950 sm:text-3xl"
            >
              {step.title}
            </h3>
            <p id="singles-hint" className="mt-3 text-sm text-muted">
              {step.required ? "Required" : "Optional"}
              {step.multiple ? " · Select all that apply." : ""}
            </p>
            <div className="mt-7">
              {step.type ? (
                <input
                  id={step.field}
                  name={step.field}
                  type={step.type}
                  autoComplete={step.autoComplete}
                  required={step.required}
                  value={form[step.field]}
                  disabled={saving}
                  maxLength={step.field === "fullName" ? 150 : step.field === "phone" ? 50 : 254}
                  aria-labelledby="singles-question"
                  aria-describedby={`singles-hint${errors[step.field] ? " singles-field-error" : ""}`}
                  aria-invalid={!!errors[step.field]}
                  className={inputClass}
                  onChange={(event) => update(step.field, event.target.value)}
                />
              ) : (
                <fieldset
                  aria-labelledby="singles-question"
                  aria-describedby={`singles-hint${errors[step.field] ? " singles-field-error" : ""}`}
                  aria-invalid={!!errors[step.field]}
                  disabled={saving}
                >
                  <legend className="sr-only">{step.title}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {step.options.map((option, index) => {
                      const checked = step.multiple
                        ? form.expectations.includes(option)
                        : form[step.field] === option;
                      return (
                        <label
                          key={option}
                          className={cn(
                            "flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-left font-semibold text-text transition-all",
                            checked
                              ? "border-rose-600 bg-rose-100 shadow-[var(--shadow-medium)]"
                              : "border-rose-200 bg-blush-50 hover:border-rose-500"
                          )}
                        >
                          <input
                            id={index === 0 ? step.field : `${step.field}-${index}`}
                            type={step.multiple ? "checkbox" : "radio"}
                            name={step.field}
                            value={option}
                            checked={checked}
                            required={step.required}
                            className="h-5 w-5 shrink-0 border-rose-500 text-rose-500 focus:ring-rose-400"
                            onChange={() =>
                              update(
                                step.field,
                                step.multiple
                                  ? checked
                                    ? form.expectations.filter((item) => item !== option)
                                    : [...form.expectations, option]
                                  : option
                              )
                            }
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                  {!step.required &&
                    (step.multiple ? form.expectations.length > 0 : !!form[step.field]) && (
                      <button
                        type="button"
                        className="mt-4 text-sm font-semibold text-burgundy-800 underline"
                        onClick={() => update(step.field, step.multiple ? [] : "")}
                      >
                        Clear selection
                      </button>
                    )}
                </fieldset>
              )}
              {errors[step.field] && (
                <p
                  id="singles-field-error"
                  role="alert"
                  className="mt-4 text-sm font-semibold text-error"
                >
                  {errors[step.field]}
                </p>
              )}
              {step.field === "dietary" && form.dietary === SINGLES_DIETARY[1] && (
                <div className="mt-6">
                  <label htmlFor="dietaryDetails" className="mb-3 block font-semibold">
                    Please specify your dietary restrictions or allergies.
                  </label>
                  <input
                    id="dietaryDetails"
                    name="dietaryDetails"
                    type="text"
                    required
                    maxLength={1000}
                    value={form.dietaryDetails}
                    disabled={saving}
                    className={inputClass}
                    aria-invalid={!!errors.dietaryDetails}
                    aria-describedby={errors.dietaryDetails ? "singles-dietary-error" : undefined}
                    onChange={(event) => update("dietaryDetails", event.target.value)}
                  />
                  {errors.dietaryDetails && (
                    <p
                      id="singles-dietary-error"
                      role="alert"
                      className="mt-4 text-sm font-semibold text-error"
                    >
                      {errors.dietaryDetails}
                    </p>
                  )}
                </div>
              )}
            </div>
            {error && (
              <p
                role="alert"
                className="mt-6 rounded-lg bg-error-background p-4 text-sm font-semibold text-error"
              >
                {error}
              </p>
            )}
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                disabled={saving || stepIndex === 0}
                onClick={() => {
                  setStepIndex(stepIndex - 1);
                  setErrors({});
                  setError("");
                }}
              >
                ← Back
              </Button>
              <Button type="submit" size="lg" disabled={saving}>
                {saving ? "Saving…" : stepIndex === STEPS.length - 1 ? "Register" : "Continue →"}
              </Button>
            </div>
            {saving && (
              <p role="status" className="mt-4 text-sm text-muted">
                Saving your registration. Please keep this page open.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
