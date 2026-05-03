let countriesData = [];
let hoveredCountry = null;

// Initialize Globe
const globe = Globe()
    (document.getElementById('globe-container'))
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
    .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
    .polygonAltitude(0.01)
    .polygonSideColor(() => 'rgba(255, 255, 255, 0.05)')
    .polygonStrokeColor(() => '#111')
    .polygonLabel(feat => {
        const tz = getTzString(feat);
        const timeStr = getLocalTimeStr(tz);
        return `
            <div class="globe-tooltip">
                <div class="tooltip-title">${feat.properties.ADMIN}</div>
                <div class="tooltip-time">${timeStr}</div>
            </div>
        `;
    })
    .onPolygonHover(hoverD => {
        hoveredCountry = hoverD;
        
        globe
            .polygonAltitude(d => d === hoverD ? 0.06 : 0.01)
            .polygonCapColor(d => d === hoverD ? '#ff8800' : getColorForTime(d));
            
        if (hoverD) {
            updatePanel(hoverD);
        }
    });

// Auto-rotate settings
globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.5;

// Initial point of view
globe.pointOfView({ lat: 20, lng: 0, altitude: 2 });

// Custom Color Scale based on time of day
const timeColorScale = d3.scaleSequential()
    .domain([0, 24])
    .interpolator(t => {
        if (t < 0.25) return d3.interpolate('#0f172a', '#4c1d95')(t / 0.25);
        if (t < 0.5) return d3.interpolate('#4c1d95', '#fbbf24')((t - 0.25) / 0.25);
        if (t < 0.75) return d3.interpolate('#fbbf24', '#be185d')((t - 0.5) / 0.25);
        return d3.interpolate('#be185d', '#0f172a')((t - 0.75) / 0.25);
    });

// Map ISO_A2 country codes to major IANA timezones to properly handle daylight savings time
const tzMap = {
    "AU": "Australia/Sydney",
    "US": "America/New_York",
    "GB": "Europe/London",
    "DE": "Europe/Berlin",
    "FR": "Europe/Paris",
    "BR": "America/Sao_Paulo",
    "RU": "Europe/Moscow",
    "CA": "America/Toronto",
    "CN": "Asia/Shanghai",
    "IN": "Asia/Kolkata",
    "JP": "Asia/Tokyo",
    "ZA": "Africa/Johannesburg",
    "MX": "America/Mexico_City",
    "AR": "America/Argentina/Buenos_Aires",
    "NZ": "Pacific/Auckland",
    "IT": "Europe/Rome",
    "ES": "Europe/Madrid",
    "KR": "Asia/Seoul",
    "ID": "Asia/Jakarta",
    "SA": "Asia/Riyadh",
    "TR": "Europe/Istanbul",
    "NG": "Africa/Lagos",
    "EG": "Africa/Cairo",
    "IR": "Asia/Tehran",
    "PK": "Asia/Karachi",
    "BD": "Asia/Dhaka",
    "VN": "Asia/Ho_Chi_Minh",
    "TH": "Asia/Bangkok",
    "PH": "Asia/Manila",
    "CO": "America/Bogota",
    "PE": "America/Lima",
    "CL": "America/Santiago",
    "VE": "America/Caracas",
    "UA": "Europe/Kyiv",
    "PL": "Europe/Warsaw",
    "SE": "Europe/Stockholm",
    "NO": "Europe/Oslo",
    "FI": "Europe/Helsinki",
    "DK": "Europe/Copenhagen",
    "NL": "Europe/Amsterdam",
    "BE": "Europe/Brussels",
    "CH": "Europe/Zurich",
    "AT": "Europe/Vienna",
    "GR": "Europe/Athens",
    "AE": "Asia/Dubai",
    "IL": "Asia/Jerusalem",
    "SG": "Asia/Singapore",
    "MY": "Asia/Kuala_Lumpur",
    "KE": "Africa/Nairobi",
    "MA": "Africa/Casablanca",
    "DZ": "Africa/Algiers",
    "GH": "Africa/Accra"
};

function getCentroid(feature) {
    let minLng = 180, maxLng = -180;
    if (feature.geometry.type === 'Polygon') {
        feature.geometry.coordinates[0].forEach(coord => {
            if (coord[0] < minLng) minLng = coord[0];
            if (coord[0] > maxLng) maxLng = coord[0];
        });
    } else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach(poly => {
            poly[0].forEach(coord => {
                if (coord[0] < minLng) minLng = coord[0];
                if (coord[0] > maxLng) maxLng = coord[0];
            });
        });
    }
    return (minLng + maxLng) / 2;
}

function getTzString(feat) {
    const iso2 = feat.properties.ISO_A2;
    if (tzMap[iso2]) return tzMap[iso2];
    
    // Fallback: Estimate timezone from centroid longitude if not in the map
    const lng = getCentroid(feat);
    let offset = Math.round(lng / 15);
    if (offset < -12) offset = -12;
    if (offset > 14) offset = 14;
    
    const sign = offset > 0 ? '-' : '+'; // Inverted because Etc/GMT-10 means UTC+10
    const absOffset = Math.abs(offset);
    return absOffset === 0 ? 'UTC' : `Etc/GMT${sign}${absOffset}`;
}

function getLocalHour(tzString) {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tzString,
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        });
        const parts = formatter.formatToParts(new Date());
        let hour = 0, minute = 0, second = 0;
        for (const part of parts) {
            if (part.type === 'hour') hour = parseInt(part.value, 10);
            if (part.type === 'minute') minute = parseInt(part.value, 10);
            if (part.type === 'second') second = parseInt(part.value, 10);
        }
        if (hour === 24) hour = 0;
        return hour + (minute / 60) + (second / 3600);
    } catch (e) {
        return 12; // Fallback to noon on error
    }
}

function getColorForTime(feat) {
    const tz = getTzString(feat);
    const localHour = getLocalHour(tz);
    return timeColorScale(localHour);
}

function getLocalTimeStr(tzString) {
    try {
        return new Date().toLocaleTimeString('en-US', {
            timeZone: tzString,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch (e) {
        return "--:--:--";
    }
}

function getLocalDateStr(tzString) {
    try {
        return new Date().toLocaleDateString('en-US', {
            timeZone: tzString,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (e) {
        return "---";
    }
}

function getOffsetStr(tzString) {
    try {
        const parts = new Intl.DateTimeFormat('en-US', { 
            timeZone: tzString, 
            timeZoneName: 'shortOffset' 
        }).formatToParts(new Date());
        const tzPart = parts.find(p => p.type === 'timeZoneName');
        // E.g., will return "GMT+10" which perfectly describes the offset including daylight savings
        return tzPart ? tzPart.value : tzString; 
    } catch (e) {
        return "UTC Offset: --";
    }
}

function updatePanel(feat) {
    document.getElementById('country-name').textContent = feat.properties.ADMIN;
    
    const tz = getTzString(feat);
    document.getElementById('local-time').textContent = getLocalTimeStr(tz);
    document.getElementById('local-date').textContent = getLocalDateStr(tz);
    document.getElementById('timezone-info').textContent = getOffsetStr(tz);
}

// Fetch GeoJSON Data
fetch('https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
    .then(res => res.json())
    .then(countries => {
        countriesData = countries.features;
        
        globe
            .polygonsData(countriesData)
            .polygonCapColor(feat => getColorForTime(feat));
        
        // Start live time update loop for the panel
        setInterval(() => {
            if (hoveredCountry) {
                updatePanel(hoveredCountry);
            }
            
            // Update the globe colors slowly (every minute)
            const now = new Date();
            if (now.getSeconds() === 0 && !hoveredCountry) {
                globe.polygonCapColor(feat => getColorForTime(feat));
            }
        }, 1000);
    })
    .catch(err => console.error("Error loading GeoJSON data:", err));

// Handle window resize
window.addEventListener('resize', () => {
    globe.width(window.innerWidth);
    globe.height(window.innerHeight);
});

// Accordion Interactivity & Accessibility
const accordionToggle = document.getElementById('accordion-toggle');
const accordionContent = document.getElementById('accordion-content');

accordionToggle.addEventListener('click', () => {
    const isExpanded = accordionToggle.getAttribute('aria-expanded') === 'true';
    accordionToggle.setAttribute('aria-expanded', !isExpanded);
    accordionContent.setAttribute('aria-hidden', isExpanded);
    accordionContent.classList.toggle('open');
});

// Font Personalization
const fontSelect = document.getElementById('font-select');
if (fontSelect) {
    fontSelect.addEventListener('change', (e) => {
        const selectedFont = e.target.value;
        
        // Load the font from Google Fonts if it's not the default
        const fontId = `font-${selectedFont.replace(/\s+/g, '-')}`;
        if (!document.getElementById(fontId) && selectedFont !== 'Outfit') {
            const link = document.createElement('link');
            link.id = fontId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${selectedFont.replace(/\s+/g, '+')}:wght@300;400;600&display=swap`;
            document.head.appendChild(link);
        }
        
        // Apply the font to the body
        document.body.style.fontFamily = `"${selectedFont}", sans-serif`;
        
        // Apply the font to the globe tooltip specifically as it's injected inside the container
        let tooltipStyle = document.getElementById('dynamic-tooltip-font');
        if (!tooltipStyle) {
            tooltipStyle = document.createElement('style');
            tooltipStyle.id = 'dynamic-tooltip-font';
            document.head.appendChild(tooltipStyle);
        }
        tooltipStyle.textContent = `.globe-tooltip { font-family: "${selectedFont}", sans-serif !important; }`;
    });
}