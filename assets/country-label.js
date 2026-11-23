/* API-Football country names are also filter values. Localize only their displayed labels. */
(function (root) {
  'use strict';
  const regions = {
    Albania:'AL', Algeria:'DZ', Andorra:'AD', Angola:'AO', 'Antigua-And-Barbuda':'AG', Argentina:'AR',
    Armenia:'AM', Aruba:'AW', Australia:'AU', Austria:'AT', Azerbaijan:'AZ', Bahrain:'BH',
    Bangladesh:'BD', Belarus:'BY', Belgium:'BE', Benin:'BJ', Bolivia:'BO', Bosnia:'BA',
    Botswana:'BW', Brazil:'BR', Bulgaria:'BG', 'Burkina-Faso':'BF', Burundi:'BI', Cambodia:'KH',
    Cameroon:'CM', Canada:'CA', Chile:'CL', China:'CN', Colombia:'CO',
    Congo:'CG', 'Congo-DR':'CD', 'Costa-Rica':'CR', Croatia:'HR', Cyprus:'CY', 'Czech-Republic':'CZ',
    Denmark:'DK', 'Dominican-Republic':'DO', Ecuador:'EC', Egypt:'EG', 'El-Salvador':'SV', Estonia:'EE',
    Eswatini:'SZ', Ethiopia:'ET', France:'FR', Gambia:'GM', Georgia:'GE', Germany:'DE',
    Ghana:'GH', Gibraltar:'GI', Greece:'GR', Guatemala:'GT', Guinea:'GN', Honduras:'HN',
    'Hong-Kong':'HK', Hungary:'HU', India:'IN', Indonesia:'ID', Iran:'IR', Iraq:'IQ',
    Ireland:'IE', Israel:'IL', Italy:'IT', 'Ivory-Coast':'CI', Jamaica:'JM', Japan:'JP',
    Jordan:'JO', Kazakhstan:'KZ', Kenya:'KE', Kosovo:'XK', Kuwait:'KW', Laos:'LA',
    Latvia:'LV', Lebanon:'LB', Lesotho:'LS', Liberia:'LR', Libya:'LY', Lithuania:'LT',
    Luxembourg:'LU', Macedonia:'MK', Malawi:'MW', Malaysia:'MY', Mali:'ML', Malta:'MT',
    Mauritania:'MR', Mexico:'MX', Moldova:'MD', Montenegro:'ME', Morocco:'MA', Myanmar:'MM',
    Netherlands:'NL', 'New-Zealand':'NZ', Nicaragua:'NI', Nigeria:'NG', Norway:'NO', Oman:'OM',
    Panama:'PA', Paraguay:'PY', Peru:'PE', Philippines:'PH', Poland:'PL', Portugal:'PT',
    Qatar:'QA', Romania:'RO', Russia:'RU', Rwanda:'RW', 'San-Marino':'SM', 'Saudi-Arabia':'SA',
    Senegal:'SN', Serbia:'RS', Singapore:'SG', Slovakia:'SK', Slovenia:'SI', 'South-Africa':'ZA',
    'South-Korea':'KR', Spain:'ES', Suriname:'SR', Sweden:'SE', Switzerland:'CH', Syria:'SY',
    Tajikistan:'TJ', Tanzania:'TZ', Thailand:'TH', Tunisia:'TN', Turkey:'TR', Turkmenistan:'TM',
    USA:'US', Uganda:'UG', Ukraine:'UA', 'United-Arab-Emirates':'AE', Uruguay:'UY', Uzbekistan:'UZ',
    Venezuela:'VE', Vietnam:'VN', World:'001', Zambia:'ZM', Zimbabwe:'ZW'
  };
  // These football associations aren't represented by the standard ISO region labels.
  const associations = {
    England: {ro:'Anglia', fr:'Angleterre', es:'Inglaterra', it:'Inghilterra', id:'Inggris'},
    Scotland: {ro:'Scoția', fr:'Écosse', es:'Escocia', it:'Scozia', id:'Skotlandia'},
    Wales: {ro:'Țara Galilor', fr:'Pays de Galles', es:'Gales', it:'Galles', id:'Wales'},
    'Northern-Ireland': {ro:'Irlanda de Nord', en:'Northern Ireland', fr:'Irlande du Nord', es:'Irlanda del Norte', it:'Irlanda del Nord', id:'Irlandia Utara'},
    'Chinese-Taipei': {ro:'Taipeiul Chinez', en:'Chinese Taipei', fr:'Taipei chinois', es:'China Taipéi', it:'Taipei Cinese', id:'Taipei Tionghoa'}
  };
  const displayNames = new Map();
  function label(country, locale) {
    if (typeof country !== 'string' || !country) return country;
    const key = country.trim().replace(/\s+/g, '-');
    if (Object.prototype.hasOwnProperty.call(associations, key)) {
      return associations[key][locale?.split('-')[0]] || country;
    }
    if (!Object.prototype.hasOwnProperty.call(regions, key) || typeof Intl.DisplayNames !== 'function') return country;
    try {
      if (!displayNames.has(locale)) displayNames.set(locale, new Intl.DisplayNames(locale, {type:'region', fallback:'none'}));
      return displayNames.get(locale).of(regions[key]) || country;
    } catch (_) {
      return country;
    }
  }
  function flag(country) {
    const key = typeof country === 'string' ? country.trim().replace(/\s+/g, '-') : '';
    const code = regions[key];
    return typeof code === 'string' && /^[A-Z]{2}$/.test(code)
      ? String.fromCodePoint(...[...code].map(letter => 0x1f1e6 + letter.charCodeAt(0) - 65))
      : '🌐';
  }
  const api = {label, flag};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PoseidonCountry = api;
})(typeof window !== 'undefined' ? window : globalThis);
