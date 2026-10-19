import type { Band, DrawingType, RecordingType } from "../lib/api";

// Common early motor and non-motor signs of Parkinson's disease. Yes answers
// are counted; the fraction of yes answers is the survey score (0–1).
export const SURVEY: string[] = [
  "Do you have a shaking or trembling in a hand, arm, or leg while it is resting?",
  "Have everyday movements (buttoning, walking, getting up) become noticeably slower?",
  "Has your handwriting become smaller or more cramped than it used to be?",
  "Have people told you your voice has become softer or more monotone?",
  "Have you noticed a reduced sense of smell?",
  "Do you act out your dreams in your sleep (talking, punching, kicking)?",
  "Do you have ongoing constipation without another clear cause?",
  "Do your arms, legs, or neck often feel stiff?",
];

// Square-spiral meander template (unit coordinates), like the printed sheet
// people traced in the meander training dataset. Starts outside, ends in the center.
export const MEANDER_TEMPLATE: [number, number][] = [
  [0.08, 0.95], [0.08, 0.06], [0.92, 0.06], [0.92, 0.86], [0.3, 0.86],
  [0.3, 0.28], [0.72, 0.28], [0.72, 0.64], [0.52, 0.64], [0.52, 0.48],
];

export const DRAWINGS: { type: DrawingType; label: string; how: string }[] = [
  {
    type: "spiral",
    label: "Spiral",
    how: "Start in the center and spiral outward in one continuous line, about 3–4 turns.",
  },
  {
    type: "wave",
    label: "Wave",
    how: "Draw a smooth repeating wave from left to right, keeping the peaks even.",
  },
  {
    type: "meander",
    label: "Meander",
    how: "Trace over the black square spiral in one continuous line, starting at the bottom-left end and finishing in the center. Staying close to the line matters more than speed.",
  },
];

// "The North Wind and the Sun" (Aesop), the standard phonetics passage.
export const PASSAGE =
  "The North Wind and the Sun were disputing which was the stronger, when a traveler " +
  "came along wrapped in a warm cloak. They agreed that the one who first succeeded in " +
  "making the traveler take his cloak off should be considered stronger than the other. " +
  "Then the North Wind blew as hard as he could, but the more he blew the more closely " +
  "did the traveler fold his cloak around him; and at last the North Wind gave up the " +
  "attempt. Then the Sun shined out warmly, and immediately the traveler took off his " +
  "cloak. And so the North Wind was obliged to confess that the Sun was the stronger of the two.";

export const RECORDINGS: { type: RecordingType; label: string; how: string; minSec: number; maxSec: number }[] = [
  {
    type: "ahh",
    label: "Sustained “ahh”",
    how: "Take a breath, then hold a steady “ahh” at a comfortable pitch and volume for about 5 seconds.",
    minSec: 3,
    maxSec: 8,
  },
  {
    type: "text",
    label: "Read a passage",
    how: "Read the passage below aloud at your normal pace. Stop the recording when you finish.",
    minSec: 8,
    maxSec: 90,
  },
];

// Held-out accuracy for each live test, shown on the result and report.
// Handwriting numbers are from the paper; voice numbers are filled from the
// retrained models' subject-wise cross-validation (training/metrics.json).
export const ACCURACY: Record<DrawingType | RecordingType, string> = {
  spiral: "90.0% (81/90 test drawings)",
  wave: "93.3% (84/90 test drawings)",
  meander: "94.6% (70/74 test drawings)",
  ahh: "73.3% (81 speakers, subject-wise CV)",
  text: "73.9% (37 speakers, subject-wise CV)",
};

export const BAND_COPY: Record<Band, { title: string; body: string }> = {
  low: {
    title: "Low",
    body: "Your results show few of the patterns the models associate with Parkinson’s disease.",
  },
  moderate: {
    title: "Moderate",
    body: "Some of your results show patterns the models associate with Parkinson’s disease. Consider mentioning this to your doctor, especially if you have symptoms.",
  },
  elevated: {
    title: "Elevated",
    body: "Several of your results show patterns the models associate with Parkinson’s disease. We suggest talking to a doctor or movement-disorder specialist.",
  },
};

export const DISCLAIMER =
  "NeuroTrace is a screening aid built for the Congressional App Challenge, not a medical " +
  "device. It cannot diagnose Parkinson’s disease or any other condition. Many things, " +
  "including a noisy room, a shaky table, or a cold, can affect the results. Only a " +
  "clinician can make a diagnosis.";
