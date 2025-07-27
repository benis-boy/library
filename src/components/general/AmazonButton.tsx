import InfoText from './StyledComponents';

const amazonDomains: Record<string, string> = {
  US: 'amazon.com',
  GB: 'amazon.co.uk',
  DE: 'amazon.de',
  FR: 'amazon.fr',
  IT: 'amazon.it',
  ES: 'amazon.es',
  CA: 'amazon.ca',
  AU: 'amazon.com.au',
  IN: 'amazon.in',
};

function getAmazonDomain(locale: string): string {
  const parts = locale.split('-');
  const lang = parts[0]?.toUpperCase(); // e.g. "DE" from "de"
  const region = parts[1]?.toUpperCase(); // e.g. "US" from "en-US"

  return (
    amazonDomains[region] || // prioritize region
    amazonDomains[lang] || // fallback to language
    'amazon.com' // default
  );
}

export function AmazonBuyButton({ asin }: { asin: string }) {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  const domain = getAmazonDomain(locale);
  const href = `https://assoc-redirect.amazon.com/g/r/https://${domain}/dp/${asin}`;
  return (
    <div>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2"
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#ff9900',
          color: '#000',
          textDecoration: 'none',
          fontWeight: 'bold',
          borderRadius: '4px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        }}
      >
        <i className="fab fa-amazon pt-1.5" /> {/* or your SVG/icon */}
        Buy it on {domain}
      </a>
      <InfoText>Please ensure the domain is correct 😊</InfoText>
    </div>
  );
}
