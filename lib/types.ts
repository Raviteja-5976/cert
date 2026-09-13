export type WorkshopResource = { title: string; url: string; description?: string };

export type Workshop = {
  id: string;
  name: string;
  slug: string;
  workshop_start_date: string;
  workshop_end_date: string | null;
  certificate_issue_date: string | null;
  certificate_prefix: string;
  // Certificate face wording. Null until the workshop row is configured.
  event_name: string | null;
  course_name: string | null;
  format_label: string | null;
  projects_completed: number | null;
  promo_code: string | null;
  interview_platform_url: string | null;
  dev_tools_url: string | null;
  resources: WorkshopResource[];
};

export type Student = {
  id: string;
  email: string;
  /** Name printed on the certificate: the student's correction if set, else the roster name. */
  name: string;
  /** Untouched roster name, kept so a correction is always auditable. */
  registeredName: string;
  /** True when the student has supplied their own spelling. */
  nameEdited: boolean;
  workshop_id: string;
};

export type CertificateSummary = {
  certificateNumber: string;
  claimedAt: string;
  emailSent: boolean;
};

export type MeResponse = {
  student: {
    name: string;
    email: string;
    registeredName: string;
    nameEdited: boolean;
    /** False once the certificate exists - the PDF is already rendered with that name. */
    canEditName: boolean;
  };
  workshop: {
    name: string;
    date: string;
    promoCode: string | null;
    interviewUrl: string | null;
    devToolsUrl: string | null;
    resources: WorkshopResource[];
  };
  feedbackSubmitted: boolean;
  certificate: CertificateSummary | null;
};
