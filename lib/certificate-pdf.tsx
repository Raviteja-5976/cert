import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { assetPath, type CertificateArtwork } from "./assets";

const INK = "#1B1F3B";
const PAPER = "#FFFDF7";
const SUNK = "#F7F0E6";
const ORANGE = "#FF6B35";
const SKY = "#4EA8FF";
const YELLOW = "#FFC93C";
const MUTED = "#5A5F7A";
const FAINT = "#8A8496";

const TAGLINE = "Learn. Build. Deploy.";
const SIGNATORY_NAME = "Raviteja Karnati";
const SIGNATORY_TITLE = "Founder, DevTrackAcademy";

let fontsReady = false;
/** Registers the brand typefaces from bundled TTFs so output never depends on the network. */
function registerFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Space Grotesk",
    fonts: [
      { src: assetPath("fonts/SpaceGrotesk-Medium.ttf"), fontWeight: 500 },
      { src: assetPath("fonts/SpaceGrotesk-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Inter",
    fonts: [
      { src: assetPath("fonts/Inter-Regular.ttf"), fontWeight: 400 },
      { src: assetPath("fonts/Inter-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.register({
    family: "Caveat",
    fonts: [{ src: assetPath("fonts/Caveat-Bold.ttf"), fontWeight: 700 }],
  });
  Font.register({
    family: "JetBrains Mono",
    fonts: [
      { src: assetPath("fonts/JetBrainsMono-Regular.ttf"), fontWeight: 400 },
      { src: assetPath("fonts/JetBrainsMono-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Keep long names intact rather than hyphenating them across the sheet.
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const styles = StyleSheet.create({
  page: { backgroundColor: PAPER, padding: 24, fontFamily: "Inter", color: INK },
  shadow: { position: "absolute", top: 30, left: 30, right: 18, bottom: 18, backgroundColor: INK, borderRadius: 14 },
  frame: {
    flexGrow: 1,
    borderWidth: 4,
    borderColor: INK,
    borderStyle: "solid",
    borderRadius: 14,
    backgroundColor: PAPER,
    paddingVertical: 16,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center" },
  brandMark: { width: 26, height: 26, objectFit: "contain", marginRight: 7 },
  wordmark: { fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 14, letterSpacing: -0.5 },
  wordmarkAccent: { color: ORANGE },
  headerTag: {
    fontFamily: "JetBrains Mono",
    fontWeight: 700,
    fontSize: 6.5,
    letterSpacing: 1.3,
    backgroundColor: YELLOW,
    borderWidth: 1.5,
    borderColor: INK,
    borderStyle: "solid",
    borderRadius: 20,
    paddingVertical: 3.5,
    paddingHorizontal: 8,
  },

  body: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  title: { fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 30, letterSpacing: -0.9, marginBottom: 13 },
  caption: { fontFamily: "Inter", fontWeight: 400, fontSize: 10.5, color: MUTED, textAlign: "center" },
  nameWrap: {
    alignSelf: "center",
    borderBottomWidth: 3,
    borderBottomColor: ORANGE,
    borderBottomStyle: "solid",
    marginTop: 9,
    marginBottom: 11,
    paddingHorizontal: 16,
    paddingBottom: 4,
    maxWidth: 620,
  },
  name: { fontFamily: "Space Grotesk", fontWeight: 700, letterSpacing: -0.8, textAlign: "center" },
  courseChip: {
    marginTop: 9,
    backgroundColor: SKY,
    borderWidth: 2.5,
    borderColor: INK,
    borderStyle: "solid",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 18,
  },
  courseName: { fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 18, textAlign: "center" },
  eventLine: { fontFamily: "Inter", fontWeight: 600, fontSize: 12, marginTop: 11, textAlign: "center" },
  eventName: { color: ORANGE },
  achievement: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize: 9.5,
    lineHeight: 1.55,
    color: MUTED,
    textAlign: "center",
    maxWidth: 565,
    marginTop: 11,
  },
  achievementStrong: { fontWeight: 600, color: INK },

  specs: { flexDirection: "row", marginTop: 12, borderWidth: 2, borderColor: INK, borderStyle: "solid", borderRadius: 9, backgroundColor: SUNK },
  spec: { flex: 1, paddingVertical: 8.5, paddingHorizontal: 11, borderRightWidth: 2, borderRightColor: INK, borderRightStyle: "solid" },
  specLast: { borderRightWidth: 0 },
  specLabel: { fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 5.8, letterSpacing: 1.1, color: FAINT },
  specValue: { fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 10.5, marginTop: 3 },

  partners: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1.5,
    borderTopColor: "#D9D2C6",
    borderTopStyle: "solid",
    paddingTop: 8,
    marginTop: 10,
  },
  partnersLabel: { fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 6, letterSpacing: 1.5, color: FAINT, marginRight: 12 },
  partnerLogo: { height: 23, objectFit: "contain", marginHorizontal: 8 },
  partnerLogoTall: { height: 28, objectFit: "contain", marginHorizontal: 8 },

  footer: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 },
  footerCol: { width: 210 },
  metaLabel: { fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 6, letterSpacing: 1.2, color: FAINT },
  metaValue: { fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 8.5, marginTop: 1.5, marginBottom: 6 },
  signature: { alignItems: "center", width: 210 },
  signatureScript: { fontFamily: "Caveat", fontWeight: 700, fontSize: 27, color: INK, marginBottom: -2 },
  signatureImage: { height: 38, objectFit: "contain", marginBottom: -1 },
  signatureRule: { width: 170, borderBottomWidth: 1.5, borderBottomColor: INK, borderBottomStyle: "solid", marginBottom: 4, marginTop: 3 },
  signatureName: { fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 10.5 },
  signatureRole: { fontFamily: "Inter", fontWeight: 600, fontSize: 7.5, color: MUTED, marginTop: 2 },
  brandCol: { width: 210, alignItems: "flex-end" },
  brandColMark: { width: 22, height: 22, objectFit: "contain", marginBottom: 4 },
  brandColName: { fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 10 },
  brandColTagline: { fontFamily: "Inter", fontWeight: 400, fontSize: 7.5, color: ORANGE, marginTop: 1.5 },
});

export type CertificateProps = {
  name: string;
  certificateNumber: string;
  workshopName: string;
  workshopDate: string;
  workshopEndDate?: string | null;
  issueDate?: string | null;
  artwork: CertificateArtwork;
  eventName?: string | null;
  courseName?: string | null;
  formatLabel?: string | null;
  projectsCompleted?: number | null;
};

export function formatCertificateDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Renders a one- or two-day workshop date. Repeated parts are collapsed, so a workshop held
 * across two days in the same month reads "11 - 12 September 2026" rather than repeating both.
 */
export function formatCertificateDateRange(start: string, end?: string | null) {
  const from = new Date(`${start}T00:00:00Z`);
  const to = end ? new Date(`${end}T00:00:00Z`) : null;
  if (Number.isNaN(from.getTime())) return start;
  if (!to || Number.isNaN(to.getTime()) || to.getTime() <= from.getTime()) return formatCertificateDate(start);

  const part = (date: Date, options: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-IN", { ...options, timeZone: "UTC" });
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  const sameMonth = sameYear && from.getUTCMonth() === to.getUTCMonth();

  if (sameMonth) return `${part(from, { day: "numeric" })} - ${part(to, { day: "numeric", month: "long", year: "numeric" })}`;
  if (sameYear) return `${part(from, { day: "numeric", month: "long" })} - ${part(to, { day: "numeric", month: "long", year: "numeric" })}`;
  return `${formatCertificateDate(start)} - ${formatCertificateDate(end as string)}`;
}

export function CertificatePdf({
  name,
  certificateNumber,
  workshopName,
  workshopDate,
  workshopEndDate,
  issueDate,
  artwork,
  eventName,
  courseName,
  formatLabel,
  projectsCompleted,
}: CertificateProps) {
  registerFonts();
  const workshopDates = formatCertificateDateRange(workshopDate, workshopEndDate);
  // The certificate is dated the last day of the workshop unless the record overrides it.
  const issued = formatCertificateDate(issueDate || workshopEndDate || workshopDate);
  const png = (data: Buffer) => ({ data, format: "png" as const });

  // Every field degrades to the workshop record if the optional wording is not configured.
  const course = courseName?.trim() || workshopName;
  const format = formatLabel?.trim() || "Live Hands-on Workshop";
  const event = eventName?.trim() || null;
  const projects = typeof projectsCompleted === "number" && projectsCompleted > 0 ? projectsCompleted : null;

  // Long names shrink to stay on one line; wrapping to a second line overflows the sheet.
  const nameLength = name.trim().length;
  const nameSize = nameLength > 34 ? 22 : nameLength > 27 ? 25 : nameLength > 21 ? 27 : 30;

  const specs: Array<{ label: string; value: string }> = [
    ...(event ? [{ label: "WORKSHOP", value: event }] : []),
    { label: "COURSE", value: course },
    { label: "FORMAT", value: format },
    ...(projects ? [{ label: "PROJECTS COMPLETED", value: String(projects) }] : []),
  ];

  return (
    <Document title={`DevTrackAcademy Certificate - ${name}`} author="DevTrackAcademy" subject={course} creator="DevTrackAcademy">
      <Page size="A4" orientation="landscape" style={styles.page} wrap={false}>
        <View style={styles.shadow} />
        <View style={styles.frame}>
          <View style={styles.header}>
            <View style={styles.brand}>
              <Image src={png(artwork.logo)} style={styles.brandMark} />
              <Text style={styles.wordmark}>
                DevTrack<Text style={styles.wordmarkAccent}>Academy</Text>
              </Text>
            </View>
            <Text style={styles.headerTag}>VERIFIED CREDENTIAL</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.title}>Certificate of Completion</Text>
            <Text style={styles.caption}>This certificate is proudly presented to</Text>
            <View style={styles.nameWrap}>
              <Text style={[styles.name, { fontSize: nameSize }]}>{name}</Text>
            </View>
            <Text style={styles.caption}>for successfully completing the {format} on</Text>
            <View style={styles.courseChip}>
              <Text style={styles.courseName}>{course}</Text>
            </View>
            <Text style={styles.eventLine}>
              {event && (
                <>
                  as part of <Text style={styles.eventName}>{event}</Text>,{" "}
                </>
              )}
              held on <Text style={styles.eventName}>{workshopDates}</Text>
            </Text>
            <Text style={styles.achievement}>
              {projects ? (
                <>
                  The participant successfully completed{" "}
                  <Text style={styles.achievementStrong}>
                    {projects} hands-on {projects === 1 ? "project" : "projects"}
                  </Text>
                  , demonstrating
                </>
              ) : (
                "The participant demonstrated"
              )}{" "}
              practical understanding and application of {course} concepts in a live workshop environment.
            </Text>
          </View>

          <View>
            <View style={styles.specs}>
              {specs.map((item, index) => (
                <View key={item.label} style={index === specs.length - 1 ? [styles.spec, styles.specLast] : styles.spec}>
                  <Text style={styles.specLabel}>{item.label}</Text>
                  <Text style={styles.specValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.partners}>
              <Text style={styles.partnersLabel}>IN ASSOCIATION WITH</Text>
              <Image src={png(artwork.gni)} style={styles.partnerLogo} />
              <Image src={png(artwork.ieee)} style={styles.partnerLogo} />
              <Image src={png(artwork.jubilee)} style={styles.partnerLogoTall} />
              <Image src={png(artwork.anniversary)} style={styles.partnerLogoTall} />
            </View>

            <View style={styles.footer}>
              <View style={styles.footerCol}>
                <Text style={styles.metaLabel}>CERTIFICATE ID</Text>
                <Text style={styles.metaValue}>{certificateNumber}</Text>
                <Text style={styles.metaLabel}>ISSUE DATE</Text>
                <Text style={styles.metaValue}>{issued}</Text>
              </View>
              <View style={styles.signature}>
                {artwork.signature ? (
                  <Image src={png(artwork.signature)} style={styles.signatureImage} />
                ) : (
                  <Text style={styles.signatureScript}>{SIGNATORY_NAME}</Text>
                )}
                <View style={styles.signatureRule} />
                <Text style={styles.signatureName}>{SIGNATORY_NAME}</Text>
                <Text style={styles.signatureRole}>{SIGNATORY_TITLE}</Text>
              </View>
              <View style={styles.brandCol}>
                <Image src={png(artwork.logo)} style={styles.brandColMark} />
                <Text style={styles.brandColName}>DevTrackAcademy</Text>
                <Text style={styles.brandColTagline}>{TAGLINE}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
