const fs = require('fs');
const content = fs.readFileSync('src/pages/Settings.tsx', 'utf8');

const getSection = (marker, nextMarker) => {
  const start = content.indexOf(`{/* ${marker} */}`);
  if (start === -1) throw new Error(`Marker ${marker} not found`);
  const end = nextMarker 
    ? content.indexOf(`{/* ${nextMarker} */}`) 
    : content.indexOf('<div className="mt-12 pt-8 border-t border-red-100');
  if (end === -1) throw new Error(`Next marker ${nextMarker} not found`);
  return content.slice(start, end).trim();
};

const profile = getSection("Unternehmensprofil", "Aussehen");
const aussehen = getSection("Aussehen", "Kalender Einstellungen");
const cal = getSection("Kalender Einstellungen", "Feiertage");
const holidays = getSection("Feiertage", "Mitarbeiter");

const mitarbeiterStart = content.indexOf('{/* Mitarbeiter */}');
const mitEndMarker = content.indexOf('</div>\n\n        <div className="space-y-8">');
if (mitarbeiterStart === -1 || mitEndMarker === -1) throw new Error("Mitarbeiter section bounds error");
const mitarbeiter = content.slice(mitarbeiterStart, mitEndMarker).trim();

const dienste = getSection("Dienstleistungen verwalten", "SMS-Anbieter");
const smsStart = content.indexOf('{/* SMS-Anbieter (Twilio) */}');
const smsEnd = content.indexOf('<div className="mt-12 pt-8 border-t border-red-100');
const sms = content.slice(smsStart, smsEnd).trim();

const newContentArray = [
  '      <div className="space-y-8 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-8">',
  '        <div className="space-y-8">',
  profile,
  "",
  dienste,
  "",
  mitarbeiter,
  '        </div>',
  '',
  '        <div className="space-y-8">',
  cal,
  "",
  holidays,
  "",
  aussehen,
  "",
  sms,
  '        </div>',
  '      </div>'
];

const startReplace = content.indexOf('      <div className="flex flex-col gap-8">');
const endReplace = content.indexOf('<div className="mt-12 pt-8 border-t border-red-100');

if (startReplace === -1 || endReplace === -1) throw new Error('Replacement bounds error');

const newContent = content.slice(0, startReplace) + newContentArray.join('\n') + '\n\n      ' + content.slice(endReplace);

fs.writeFileSync('src/pages/Settings.tsx', newContent);
console.log('Reordered settings logic');
