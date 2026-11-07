/* =====================================================================
   authority.js — THE HUB'S OWN AUTHORITY FILE
   ---------------------------------------------------------------------
   Records come from institutions (feeds.js). This file is what the hub
   itself maintains so records from different places can be CONNECTED:
     • INSTITUTIONS  — who holds things, and how to visit / contact them
     • PLACES        — gazetteer; coordinates come ONLY from the Canadian
                       Geographical Names Database (CGNDB, NRCan). A place
                       with no CGNDB entry gets no pin. Nothing is guessed.
     • ENTITIES      — people, communities, organizations, events, topics,
                       each with name variants ("aliases") for matching
     • STATEMENTS    — short context sentences QUOTED from a named source,
                       always with its link. The hub writes no history.
     • RELATIONS     — curated links between entities, each with evidence
   ===================================================================== */

const CGNDB = id => `https://geogratis.gc.ca/services/geoname/en/geonames/${id}`;

/* ---------- Holding / providing institutions ---------- */
const INSTITUTIONS = {
  nsa:    { name: 'Nova Scotia Archives', kind: 'Provincial archives', web: 'https://archives.novascotia.ca/', address: '6016 University Avenue, Halifax, NS', place: 'halifax', access: 'Public reading room. Many exhibit items are digitized online; check hours before visiting.', isSource: true },
  lac:    { name: 'Library and Archives Canada', kind: 'Federal archives & library', web: 'https://library-archives.canada.ca/', address: '395 Wellington Street, Ottawa, ON', place: 'ottawa', access: 'Consult records on site or request copies. Some files must be ordered in advance.', isSource: true },
  cwm:    { name: 'Canadian War Museum', kind: 'National museum', web: 'https://www.warmuseum.ca/collections/', address: '1 Vimy Place, Ottawa, ON', place: 'ottawa', access: 'Objects are held in the museum collection; not all are on display. Contact the museum for research access.', isSource: true },
  hma:    { name: 'Halifax Municipal Archives', kind: 'Municipal archives', web: 'https://www.halifax.ca/about-halifax/municipal-archives', address: '81 Ilsley Ave, Unit 11, Burnside Industrial Park, Dartmouth, NS', place: 'dartmouth', access: 'In person by appointment (per halifax.ca). Many Africville records are digitized via the source guide.', isSource: true },
  bccns:  { name: 'Black Cultural Centre for Nova Scotia', kind: 'Community museum & cultural centre', web: 'https://bccns.com/', address: '10 Cherry Brook Road, Cherry Brook, NS', place: 'cherry-brook', access: 'Contact the Centre about viewing items from its collection.', isPartner: true },
  dhm:    { name: 'Dartmouth Heritage Museum', kind: 'Community museum', web: '', address: '', place: 'dartmouth', access: 'Visitor address not confirmed in this prototype. Contact the museum before visiting.' },
  acadia: { name: 'Esther Clark Wright Archives, Acadia University', kind: 'University archives', web: '', address: '', place: 'wolfville', access: 'Visitor details not confirmed in this prototype.' },
  dal:    { name: 'Dalhousie University Archives', kind: 'University archives', web: '', address: '', place: 'halifax', access: 'Visitor details not confirmed in this prototype.' },
  nsm:    { name: 'Nova Scotia Museum (History Collection)', kind: 'Provincial museum', web: '', address: '', place: '', access: 'Holding location not confirmed — no map pin shown.' },
  tna:    { name: 'The National Archives, Kew (UK)', kind: 'National archives (UK)', web: '', address: '', place: '', access: 'Outside Canada. Original held in the UK; Nova Scotia Archives exhibit shows a copy.' },
  bl:     { name: 'The British Library', kind: 'National library (UK)', web: '', address: '', place: '', access: 'Outside Canada. Original held in the UK.' }
};

/* ---------- Gazetteer (CGNDB ids + coordinates, copied exactly) ----------
   precision: 'community' = CGNDB point for the populated place, NOT a street
   address. Unmapped places (regions, roads, places outside the gazetteer
   lookup) are kept as entities without coordinates. */
const PLACES = {
  'halifax':               { name: 'Halifax', cgndb: 'CAPHL', lat: 44.647401, lng: -63.590651, aliases: ['Halifax'] },
  'dartmouth':             { name: 'Dartmouth', cgndb: 'CAIYJ', lat: 44.670036, lng: -63.577577, aliases: ['Dartmouth'] },
  'africville':            { name: 'Africville', cgndb: 'CBVRY', lat: 44.674492, lng: -63.618682, aliases: ['Africville'], note: 'Pin = Africville National Historic Site of Canada (CGNDB CBVRY).', community: true,
    statements: [
      ['Located on the southern shore of the Bedford Basin, Africville was officially settled in the 1840s when William Brown and William Arnold originally purchased land, although oral history suggests some families can trace their connection to the land going back to the 1700s.', 'Halifax.ca — Africville', 'https://www.halifax.ca/about-halifax/diversity-inclusion/african-nova-scotian-affairs/africville'],
      ['Africville was home to a predominantly African Nova Scotian community for more than 150 years before the City of Halifax razed and relocated the community between 1964 to 1970.', 'Halifax.ca — Africville', 'https://www.halifax.ca/about-halifax/diversity-inclusion/african-nova-scotian-affairs/africville'],
      ["Municipal records tell the story of Africville's relationship with the City of Halifax.", 'Halifax Municipal Archives — Africville source guide', 'https://www.halifax.ca/about-halifax/municipal-archives/source-guides/africville-sources']
    ] },
  'preston':               { name: 'Preston', cgndb: 'CBERX', lat: 44.715695, lng: -63.434226, aliases: ['Preston'], community: true,
    statements: [['Among the communities photographed are Preston, Upper Hammonds Plains and Five Mile Plains.', 'Nova Scotia Archives — African Nova Scotians exhibit', 'https://archives.novascotia.ca/africanns/']] },
  'north-preston':         { name: 'North Preston', cgndb: 'CBRDX', lat: 44.746176, lng: -63.46453, aliases: ['North Preston'] , community: true },
  'cherry-brook':          { name: 'Cherry Brook', cgndb: 'CAGXW', lat: 44.709662, lng: -63.479253, aliases: ['Cherry Brook'] },
  'hammonds-plains':       { name: 'Hammonds Plains', cgndb: 'CAPJF', lat: 44.733859, lng: -63.77551, aliases: ['Hammonds Plains'] },
  'upper-hammonds-plains': { name: 'Upper Hammonds Plains', cgndb: 'CBMWI', lat: 44.754482, lng: -63.84165, aliases: ['Upper Hammonds Plains'], community: true,
    statements: [['Among the communities photographed are Preston, Upper Hammonds Plains and Five Mile Plains.', 'Nova Scotia Archives — African Nova Scotians exhibit', 'https://archives.novascotia.ca/africanns/']] },
  'five-mile-plains':      { name: 'Five Mile Plains', cgndb: 'CAMFE', lat: 44.963753, lng: -64.086477, aliases: ['Five Mile Plains'], community: true,
    statements: [['Among the communities photographed are Preston, Upper Hammonds Plains and Five Mile Plains.', 'Nova Scotia Archives — African Nova Scotians exhibit', 'https://archives.novascotia.ca/africanns/']] },
  'birchtown':             { name: 'Birchtown', cgndb: 'CADRN', lat: 43.744555, lng: -65.382375, aliases: ['Birchtown'] },
  'shelburne':             { name: 'Shelburne', cgndb: 'CBIKP', lat: 43.763215, lng: -65.323507, aliases: ['Shelburne'] },
  'guysborough':           { name: 'Guysborough', cgndb: 'CAPBK', lat: 45.391322, lng: -61.497953, aliases: ['Guysborough'] },
  'sunnyville':            { name: 'Sunnyville', cgndb: 'CBLDF', lat: 45.38731, lng: -61.536422, aliases: ['Sunnyville'] },
  'weymouth-falls':        { name: 'Weymouth Falls', cgndb: 'CBOMG', lat: 44.403035, lng: -65.944467, aliases: ['Weymouth Falls'] },
  'liverpool':             { name: 'Liverpool', cgndb: 'CAUWZ', lat: 44.039147, lng: -64.714759, aliases: ['Liverpool'] },
  'windsor':               { name: 'Windsor', cgndb: 'CBPAK', lat: 44.99287, lng: -64.135677, aliases: ['Windsor'] },
  'new-glasgow':           { name: 'New Glasgow', cgndb: 'CBBJR', lat: 45.589332, lng: -62.64479, aliases: ['New Glasgow'] },
  'cow-bay':               { name: 'Cow Bay', cgndb: 'CAIAU', lat: 44.621802, lng: -63.421895, aliases: ['Cow Bay'] },
  'wolfville':             { name: 'Wolfville', cgndb: 'CBROD', lat: 45.091713, lng: -64.359242, aliases: [] },
  'ottawa':                { name: 'Ottawa', cgndb: 'FEVNT', lat: 45.33339, lng: -75.58429, aliases: [] },
  // --- known names with NO pin (regions, roads, outside lookup) ---
  'shelburne-county':      { name: 'Shelburne County', aliases: ['Shelburne County'], unmappedWhy: 'County-level name — too broad for a pin.' },
  'guysborough-county':    { name: 'Guysborough County', aliases: ['Guysborough County'], unmappedWhy: 'County-level name — too broad for a pin.' },
  'annapolis-county':      { name: 'Annapolis County', aliases: ['Annapolis County'], unmappedWhy: 'County-level name — too broad for a pin.' },
  'colchester-county':     { name: 'Colchester County', aliases: ['Colchester County'], unmappedWhy: 'County-level name — too broad for a pin.' },
  'halifax-county':        { name: 'Halifax County', aliases: ['Halifax County'], unmappedWhy: 'County-level name — too broad for a pin.' },
  'windsor-road':          { name: 'Windsor Road (1815 settlement)', aliases: ['Windsor Road'], unmappedWhy: 'Historic road settlement — location not confirmed against the gazetteer.' },
  'north-west-arm':        { name: 'North West Arm', aliases: ['North West Arm'], unmappedWhy: 'Not looked up in this prototype.' },
  'bedford-basin':         { name: 'Bedford Basin', aliases: ['Bedford Basin'], unmappedWhy: 'Water body — not pinned.' },
  'melville-island':       { name: 'Melville Island (Halifax)', aliases: ['Melville Island'], unmappedWhy: 'Not looked up in this prototype.' },
  'chesapeake':            { name: 'Chesapeake (USA)', aliases: ['Chesapeake'], unmappedWhy: 'Outside the Canadian gazetteer.' },
  'united-kingdom':        { name: 'United Kingdom', aliases: ['United Kingdom'], unmappedWhy: 'Outside the Canadian gazetteer.' }
};

/* ---------- Entities (people, organizations, events, topics) ----------
   type: person | organization | event | topic
   aliases: the exact strings to look for in titles/descriptions.
   statements: [text, sourceLabel, sourceUrl] — quoted, never paraphrased. */
const SRC = {
  nsaIntro: ['Nova Scotia Archives — African Nova Scotians exhibit', 'https://archives.novascotia.ca/africanns/'],
  hfxAfricville: ['Halifax.ca — Africville', 'https://www.halifax.ca/about-halifax/diversity-inclusion/african-nova-scotian-affairs/africville'],
  hmaGuide: ['Halifax Municipal Archives — Africville source guide', 'https://www.halifax.ca/about-halifax/municipal-archives/source-guides/africville-sources'],
  nsNews2021: ['Province of Nova Scotia news release, 3 Feb 2021', 'https://news.novascotia.ca/en/2021/02/03/province-repays-fine-and-court-cost-viola-desmond'],
  cmhr: ['Canadian Museum for Human Rights', 'https://humanrights.ca/story/viola-desmond-one-womans-resistance'],
  nsNews2010: ['Province of Nova Scotia news release, 15 Apr 2010', 'https://novascotia.ca/news/smr/2010-04-15-pardon.asp'],
  cwmBlack: ['Canadian War Museum — Black Canadians and Canada\'s Military', 'https://www.warmuseum.ca/remembrance-day-resources/black-canadians-and-canadas-military'],
  blhc: ['Black Loyalist Heritage Centre', 'https://blackloyalist.novascotia.ca/'],
  bccns: ['Black Cultural Centre for Nova Scotia', 'https://bccns.com/']
};

const ENTITIES = {
  // ---------- people ----------
  'viola-desmond': { type: 'person', name: 'Viola Desmond', aliases: ['Viola Desmond', 'Desmond, Viola', 'Viola I. Desmond'],
    statements: [
      ['Viola Desmond was found guilty of tax evasion after she challenged racial segregation at the Roseland Theatre in New Glasgow on Nov. 8, 1946.', ...SRC.nsNews2021],
      ['The justness of Desmond\'s cause was officially recognized in 2010, when the Lieutenant Governor of Nova Scotia posthumously pardoned her…', ...SRC.cmhr]
    ] },
  'rose-fortune':     { type: 'person', name: 'Rose Fortune', aliases: ['Rose Fortune'] },
  'barbary-cuffy':    { type: 'person', name: 'Barbary (Barbara) Cuffy', aliases: ['Barbary (Barbara) Cuffy', 'Barbara Cuffy'] },
  'deborah-cuffy':    { type: 'person', name: 'Deborah Cuffy', aliases: ['Deborah Cuffy'] },
  'david-george':     { type: 'person', name: 'David George', aliases: ['David George'] },
  'cato-ramsay':      { type: 'person', name: 'Cato Ramsay', aliases: ['Cato Ramsay'] },
  'phillis-thomas':   { type: 'person', name: 'Phillis Thomas', aliases: ['Phillis Thomas'] },
  'michael-thomas':   { type: 'person', name: 'Michael Thomas', aliases: ['Michael Thomas'] },
  'thomas-williams':  { type: 'person', name: 'Thomas Williams', aliases: ['Thomas Williams'] },
  'john-williams':    { type: 'person', name: 'John Williams', aliases: ['John Williams'] },
  'phillis-watson':   { type: 'person', name: 'Phillis (Watson alias Phillis)', aliases: ['Watson alias Phillis'] },
  'dinah':            { type: 'person', name: 'Dinah', aliases: ["'Dinah'"], note: 'Named in a 1776 bill of sale.' },
  'mintur':           { type: 'person', name: 'Mintur', aliases: ["'Mintur'"], note: 'Named in a 1779 sale record.' },
  'abram':            { type: 'person', name: 'Abram', aliases: ["'Abram'"], note: 'Named in a 1779 bill of sale.' },
  'gabriel-hall':     { type: 'person', name: 'Gabriel Hall', aliases: ['Gabriel Hall'] },
  'william-hall-vc':  { type: 'person', name: 'William Hall, VC', aliases: ['William Hall, VC', 'William Hall VC'] },
  'edwin-borden':     { type: 'person', name: 'Edwin Howard Borden', aliases: ['Edwin Howard Borden'] },
  'james-r-johnston': { type: 'person', name: 'James R. Johnston', aliases: ['James R. Johnston'] },
  'eddie-beals':      { type: 'person', name: 'Eddie Beals', aliases: ['Eddie Beals'] },
  'ned-beals':        { type: 'person', name: "Edward 'Ned' Beals", aliases: ["Edward 'Ned' Beals"] },
  'thomas-beals':     { type: 'person', name: 'Thomas Beals', aliases: ['Thomas Beals'] },
  'saul-bauld':       { type: 'person', name: 'Saul Bauld', aliases: ['Saul Bauld'] },
  'john-bowden':      { type: 'person', name: 'John Bowden', aliases: ['John Bowden', 'J. Bowden'] },
  'joe-izzard':       { type: 'person', name: 'Joe Izzard', aliases: ['Joe Izzard'] },
  'eliza-brody':      { type: 'person', name: 'Eliza Brody', aliases: ['Eliza Brody'] },
  'una-gibson':       { type: 'person', name: 'Una Gibson', aliases: ['Una Gibson'] },
  'john-farmer':      { type: 'person', name: 'John Farmer', aliases: ['John Farmer'] },
  'jupiter':          { type: 'person', name: 'Jupiter', aliases: ['Jupiter the slave'], note: 'Named as an ancestor of John Farmer in the record title.' },
  'william-riley':    { type: 'person', name: 'William Riley', aliases: ['William Riley'] },
  'charlie-symonds':  { type: 'person', name: 'Charlie Symonds', aliases: ['Charlie Symonds'] },
  'james-croxen':     { type: 'person', name: 'James Croxen', aliases: ['James Croxen'] },
  'rita-sampson':     { type: 'person', name: 'Rita Sampson', aliases: ['Rita Sampson'] },
  'mary-david':       { type: 'person', name: 'Mary David', aliases: ['Mary David'] },
  'samuel-johnson':   { type: 'person', name: 'Samuel Johnson', aliases: ['Samuel Johnson'] },
  'hoping-bowen':     { type: 'person', name: 'Hoping Bowen', aliases: ['Hoping Bowen'] },
  'pompey-johnson':   { type: 'person', name: 'Pompey Johnson', aliases: ['Pompey Johnson'] },
  'ellen-clark':      { type: 'person', name: 'Ellen Clark', aliases: ['Ellen Clark'] },
  'ra-young':         { type: 'person', name: 'Pte. R.A. Young', aliases: ['R.A. YOUNG', 'R.A. Young'] },
  'john-mitchell':    { type: 'person', name: 'John Mitchell (CEF 931781)', aliases: ['MITCHELL, JOHN'] },
  'ozell-borden':     { type: 'person', name: 'Ozell M. Borden', aliases: ['OZELL M. BORDEN'] },
  'albert-rose':      { type: 'person', name: 'Dr. Albert Rose', aliases: ['Albert Rose'] },
  'peter-macdonald':  { type: 'person', name: 'Peter J. MacDonald', aliases: ['Peter J. MacDonald'] },
  'gus-wedderburn':   { type: 'person', name: 'Gus Wedderburn', aliases: ['Gus Wedderburn'] },
  'wanda-robson':     { type: 'person', name: 'Wanda Robson', aliases: ['Wanda Robson'] },
  'john-ware':        { type: 'person', name: 'John Ware', aliases: ['John Ware'] },
  'adrienne-clarkson':{ type: 'person', name: 'Adrienne Clarkson', aliases: ['Adrienne Clarkson'] },
  'william-brown':    { type: 'person', name: 'William Brown', aliases: [] },
  'william-arnold':   { type: 'person', name: 'William Arnold', aliases: [] },
  'cornwallis':       { type: 'person', name: 'Governor Cornwallis', aliases: ['Governor Cornwallis'] },
  'cochrane':         { type: 'person', name: 'Admiral Cochrane', aliases: ['Admiral Cochrane'] },
  'dalhousie':        { type: 'person', name: 'Lord Dalhousie', aliases: ['Lord Dalhousie'] },
  'sherbrooke':       { type: 'person', name: 'Lieutenant Governor Sherbrooke', aliases: ['Lieutenant Governor Sherbrooke'] },
  'malachy-salter':   { type: 'person', name: 'Malachy Salter', aliases: ['Malachy Salter'] },
  'simeon-perkins':   { type: 'person', name: 'Simeon Perkins', aliases: ['Simeon Perkins'] },
  'em-macdonald':     { type: 'person', name: 'E.M. MacDonald', aliases: ['E.M. MacDonald'] },
  'justice-archibald':{ type: 'person', name: 'Justice Archibald', aliases: ['Justice Archibald', "Archibald's Decision"] },
  // creators (linked through the creator field, not the title)
  'george-craig':     { type: 'person', name: 'George H. Craig (photographer)', aliases: [], creator: ['George H. Craig'] },
  'william-buckley':  { type: 'person', name: 'William H. Buckley (photographer)', aliases: [], creator: ['William H. Buckley'] },
  'clara-dennis':     { type: 'person', name: 'Clara Dennis (photographer)', aliases: [], creator: ['Clara Dennis'] },
  'cr-brookbank':     { type: 'person', name: 'C.R. Brookbank (researcher, photographer)', aliases: [], creator: ['C.R. Brookbank'] },
  'helen-creighton':  { type: 'person', name: 'Helen Creighton', aliases: [], creator: ['Helen Creighton'] },
  'notman':           { type: 'organization', name: 'Notman Studio (photographers)', aliases: [], creator: ['Notman Studio'] },
  'gauvin-gentzel':   { type: 'organization', name: 'Gauvin & Gentzel (photographers)', aliases: [], creator: ['Gauvin & Gentzel'] },

  // ---------- organizations ----------
  'no2cb': { type: 'organization', topics: ['military'], name: 'No. 2 Construction Battalion', aliases: ['No. 2 Construction Battalion', 'NO 2 CONSTRUCTION BATTALION', 'No.2 Construction Battalion', 'No. 2 - Construction Battalion', 'No 2 CONSTRCTION', 'No. 2 CONSTRUCTION BATTALION'],
    statements: [['At least 780 men were members of a segregated Black Canadian military unit, the No. 2 Construction Battalion, which operated in Canada, England and France.', ...SRC.cwmBlack]] },
  'cef':        { type: 'organization', name: 'Canadian Expeditionary Force', aliases: ['Canadian Expeditionary Force', ', CEF'] },
  'black-pioneers': { type: 'organization', name: 'Black Pioneers', aliases: ['Black Pioneers'] },
  'ags':        { type: 'organization', name: 'Africville Genealogy Society', aliases: ['Africville Genealogy Society', 'Africville Genealogical Society'] },
  'hachr':      { type: 'organization', name: 'Halifax Advisory Committee on Human Rights', aliases: ['Halifax Advisory Committee on Human Rights', 'Halifax Human Rights Advisory Committee'] },
  'city-halifax': { type: 'organization', name: 'City of Halifax / HRM', aliases: ['City of Halifax', 'City Council', 'HRM', 'Halifax City'] },
  'house-assembly': { type: 'organization', name: 'Nova Scotia House of Assembly', aliases: ['House of Assembly'] },
  'port-roseway': { type: 'organization', name: 'Port Roseway Associates', aliases: ['Port Roseway Associates'] },
  'ame-zion':   { type: 'organization', name: 'African Methodist Episcopal Zion Church', aliases: ['African Methodist Episcopal Zion Church'], topics: ['faith'] },
  'emmanuel-baptist': { type: 'organization', name: 'Emmanuel Baptist Church, Upper Hammonds Plains', aliases: ['Emmanuel Baptist Church'], topics: ['faith', 'music'] },
  'seaview-baptist':  { type: 'organization', name: 'Seaview Baptist Church', aliases: ['Seaview Baptist Church'], topics: ['faith'] },

  // ---------- events & meetings (dated, each with evidence) ----------
  'ev-loyalists':   { type: 'event', name: 'Black Loyalists arrive in Nova Scotia (1783–1785)', year: 1783, aliases: [],
    statements: [['The Black Loyalists arrived in Nova Scotia between 1783 and 1785, as a result of the American Revolution.', ...SRC.blhc]] },
  'ev-refugees-1814': { type: 'event', name: 'Black refugees arrive at Halifax (1 Sept 1814)', year: 1814, aliases: [], place: 'halifax', evidence: ['nsa-africanns-71'] },
  'ev-africville-settled': { type: 'event', name: 'Africville officially settled (1840s)', year: 1840, aliases: [], place: 'africville',
    statements: [['Located on the southern shore of the Bedford Basin, Africville was officially settled in the 1840s when William Brown and William Arnold originally purchased land, although oral history suggests some families can trace their connection to the land going back to the 1700s.', ...SRC.hfxAfricville]] },
  'ev-roseland':    { type: 'event', name: 'Viola Desmond challenges segregation, Roseland Theatre (8 Nov 1946)', year: 1946, aliases: ['Roseland Theatre'], place: 'new-glasgow', evidence: ['nsa-desmond-1', 'nsa-desmond-2', 'nsa-desmond-3'],
    statements: [['Viola Desmond was found guilty of tax evasion after she challenged racial segregation at the Roseland Theatre in New Glasgow on Nov. 8, 1946.', ...SRC.nsNews2021]] },
  'ev-subcommittee': { type: 'event', name: 'Africville Sub-committee meetings (est. 1964)', year: 1964, aliases: ['Africville Sub-committee'], place: 'halifax', meeting: true, evidence: ['hma-Redevelopment'] },
  'ev-relocation':  { type: 'event', name: 'Africville razed and residents relocated (1964–1970)', year: 1964, aliases: ['relocation', 'Relocation Program', 'expropriation'], place: 'africville',
    statements: [['Africville was home to a predominantly African Nova Scotian community for more than 150 years before the City of Halifax razed and relocated the community between 1964 to 1970.', ...SRC.hfxAfricville]] },
  'ev-pardon':      { type: 'event', name: 'Free pardon for Viola Desmond (2010)', year: 2010, aliases: [],
    statements: [['The province has granted an official apology and free pardon to the late Viola Desmond.', ...SRC.nsNews2010]] },
  'ev-apology-2010': { type: 'event', name: 'Africville apology, Community YMCA, Gottingen Street (24 Feb 2010)', year: 2010, aliases: ['Africville Apology', 'official apology'], place: 'halifax', meeting: true,
    statements: [['On February 24, 2010, former Mayor Peter Kelly apologized to former Africville residents and their families on behalf of Halifax Regional Municipality.', ...SRC.hfxAfricville]], evidence: ['hma-NewsRelease'] },
  'ev-no2cb-100':   { type: 'event', name: 'No. 2 Construction Battalion centenary (July 2016)', year: 2016, aliases: ['Celebrating 100 Anniversary'], evidence: ['cwm-2573507'] },
  'ev-no2cb-apology': { type: 'event', name: 'National Apology to the No. 2 Construction Battalion (9 July 2022)', year: 2022, aliases: ['National Apology Event'], evidence: ['cwm-3559536'] },

  // ---------- topics (subjects). Theme/collection membership also maps here ----------
  'black-loyalists': { type: 'topic', name: 'Black Loyalists', aliases: ['Black Loyalists', 'Loyalists'],
    statements: [['The Black Loyalists arrived in Nova Scotia between 1783 and 1785, as a result of the American Revolution.', ...SRC.blhc]] },
  'black-refugees':  { type: 'topic', name: 'Black Refugees (War of 1812)', aliases: ['black refugees', 'black refugee', 'African American refugees', 'War of 1812'],
    statements: [['Approximately 10,000 black people came to Nova Scotia between 1749 and 1816.', ...SRC.nsaIntro]] },
  'enslavement':     { type: 'topic', name: 'Enslavement and freedom', aliases: ['slave', 'slaves', 'manumission', 'free Negro', 'free Black', 'freeborn Blacks', 'Sale of', 'for sale', 'Fugitive'],
    statements: [['Approximately 10,000 black people came to Nova Scotia between 1749 and 1816.', ...SRC.nsaIntro]] },
  'settlements':     { type: 'topic', name: 'Descendants and settlements', aliases: [],
    statements: [['Among the communities photographed are Preston, Upper Hammonds Plains and Five Mile Plains.', ...SRC.nsaIntro]] },
  'segregation':     { type: 'topic', name: 'Segregation and civil rights', aliases: ['segregation', 'Human Rights'] },
  'military':        { type: 'topic', name: 'Military service', aliases: ['Battalion', 'Demobilization', 'Mobilization', 'Medal', 'military', 'Black Pioneers', 'disbanded troops'] },
  'urban-renewal':   { type: 'topic', name: 'Urban renewal & displacement', aliases: ['urban renewal', 'Redevelopment', 'relocation', 'Relocation', 'expropriation', 'Master Plan', 'slum'] },
  'faith':           { type: 'topic', name: 'Church and faith', aliases: ['Church', 'church', 'baptism', 'Baptist'] },
  'work':            { type: 'topic', name: 'Work and livelihood', aliases: ['market day', 'Market', 'vendors', 'sawmill', 'cooper', 'farm', 'water carrier', 'baskets', 'cooks\''] },
  'music':           { type: 'topic', name: 'Music', aliases: ['fiddle', 'BAND', 'choir'] },
  'family':          { type: 'topic', name: 'Family and genealogy', aliases: ['family', 'generation', 'great-grandaughter', 'granddaughter', 'Genealogy', 'his wife', 'children'] },
  'education':       { type: 'topic', name: 'Education', aliases: ['School', 'Educational Fund'] },
  'housing':         { type: 'topic', name: 'Housing and land', aliases: ['housing', 'House', 'Houses', 'lands', 'Deed', 'Building Permits', 'property', 'Plot plan', 'lease'] },
  'law':             { type: 'topic', name: 'Law and the courts', aliases: ['Supreme Court', 'judgement', 'Writ', 'Affidavit', 'Appeal', 'Magistrate', 'Justice', 'Factum', 'pardon'] },
  'commemoration':   { type: 'topic', name: 'Commemoration', aliases: ['Apology', 'Celebrating', 'memorial', 'stamp', 'philatelic', 'Medallion', 'Seaview Park'] }
};

/* Which source collection / theme implies which topic or person.
   This is the source's OWN classification, mapped across — so it is
   'confirmed', not a guess. */
const THEME_MAP = {
  'nsa:1': ['enslavement'],
  'nsa:2': ['black-loyalists'],
  'nsa:4': ['black-refugees'],
  'nsa:5': ['settlements'],
  'nsa:D': ['viola-desmond', 'segregation', 'law'],
  'hma:*': ['africville'],
  'cwm:*': ['no2cb', 'military']
};

/* Curated entity→entity relations. [from, label, to, evidenceLabel, evidenceUrlOrRecordId] */
const RELATIONS = [
  ['viola-desmond', 'took part in', 'ev-roseland', ...SRC.nsNews2021],
  ['ev-roseland', 'took place in', 'new-glasgow', ...SRC.nsNews2021],
  ['ev-pardon', 'recognized', 'viola-desmond', ...SRC.nsNews2010],
  ['wanda-robson', 'co-author of a book about', 'viola-desmond', 'LAC record', 'lac-oclc-1080217412'],
  ['africville', 'located in', 'halifax', 'CGNDB location field', CGNDB('CBVRY')],
  ['africville', 'on the shore of', 'bedford-basin', ...SRC.hfxAfricville],
  ['william-brown', 'purchased land at', 'africville', ...SRC.hfxAfricville],
  ['william-arnold', 'purchased land at', 'africville', ...SRC.hfxAfricville],
  ['ev-africville-settled', 'founded', 'africville', ...SRC.hfxAfricville],
  ['city-halifax', 'carried out', 'ev-relocation', ...SRC.hfxAfricville],
  ['ev-relocation', 'displaced residents of', 'africville', ...SRC.hfxAfricville],
  ['ev-apology-2010', 'addressed former residents of', 'africville', ...SRC.hfxAfricville],
  ['city-halifax', 'issued', 'ev-apology-2010', ...SRC.hfxAfricville],
  ['albert-rose', 'reviewed', 'africville', 'HMA source guide', 'hma-Rose'],
  ['ev-subcommittee', 'advised on', 'ev-relocation', 'HMA source guide', 'hma-Redevelopment'],
  ['ags', 'took action about', 'africville', 'HMA source guide', 'hma-HRMCAO'],
  ['no2cb', 'unit of', 'cef', 'LAC record title', 'lac-fonandcol-1093815'],
  ['ra-young', 'served in', 'no2cb', 'CWM record', 'cwm-2551834'],
  ['john-mitchell', 'served in', 'no2cb', 'LAC personnel record (Unit field)', 'lac-pffww-185378'],
  ['ozell-borden', 'quilted a centenary quilt for', 'no2cb', 'CWM record', 'cwm-2573507'],
  ['ev-no2cb-apology', 'recognized', 'no2cb', 'CWM record', 'cwm-3559536'],
  ['ev-no2cb-100', 'commemorated', 'no2cb', 'CWM record', 'cwm-2573507'],
  ['rita-sampson', '7th generation of', 'samuel-johnson', 'NSA record title', 'nsa-africanns-168'],
  ['rita-sampson', '7th generation of', 'hoping-bowen', 'NSA record title', 'nsa-africanns-168'],
  ['mary-david', 'great-granddaughter of', 'samuel-johnson', 'NSA record title', 'nsa-africanns-169'],
  ['mary-david', 'granddaughter of', 'pompey-johnson', 'NSA record title', 'nsa-africanns-169'],
  ['mary-david', 'daughter of', 'ellen-clark', 'NSA record title', 'nsa-africanns-169'],
  ['john-farmer', 'descendant of', 'jupiter', 'NSA record title', 'nsa-africanns-171'],
  ['deborah-cuffy', 'shares a surname with (relationship not stated)', 'barbary-cuffy', 'Curator note — both in Liverpool records', 'nsa-africanns-9'],
  ['black-loyalists', 'theme of', 'ev-loyalists', ...SRC.blhc],
  ['ev-refugees-1814', 'part of', 'black-refugees', 'NSA record title', 'nsa-africanns-71'],
  ['preston', 'photographed community', 'settlements', ...SRC.nsaIntro],
  ['upper-hammonds-plains', 'photographed community', 'settlements', ...SRC.nsaIntro],
  ['five-mile-plains', 'photographed community', 'settlements', ...SRC.nsaIntro],
  ['north-preston', 'part of the Preston area (CGNDB location: Halifax)', 'preston', 'CGNDB', CGNDB('CBRDX')],
  ['emmanuel-baptist', 'located in', 'upper-hammonds-plains', 'NSA record title', 'nsa-africanns-184'],
  ['bccns', 'located in', 'cherry-brook', ...SRC.bccns]
];

/* Possible duplicates / unresolved identity — shown to curators, never auto-merged. */
const REVIEW_FLAGS = [
  { kind: 'possible-same-person', ids: ['eddie-beals', 'ned-beals'], why: "Both photographed by George H. Craig ca. 1890, both credited to the Dartmouth Heritage Museum. 'Eddie' and 'Edward \"Ned\"' may be the same man — the records do not say." },
  { kind: 'possible-same-person', ids: ['samuel-johnson'], why: 'Samuel Johnson is named in two Five Mile Plains records as an ancestor. Confirm both refer to the same person before merging family trees.' },
  { kind: 'harmful-language', why: 'Some titles use historical terms that are offensive today. Titles are kept exactly as the source wrote them; see Nova Scotia Archives "Access to Language".', url: 'https://archives.novascotia.ca/africanns/language/' }
];

/* Featured entities for the rotating home card.
   img: thumbnail shown FROM the source (not copied). If it fails, the card
   falls back to a typographic design. */
const FEATURED = [
  { id: 'africville', kicker: 'Community · Halifax', img: '' },
  { id: 'viola-desmond', kicker: 'Person · Civil rights', img: '' },
  { id: 'no2cb', kicker: 'Organization · First World War', img: 'https://www.warmuseum.ca/ke/_resources/5401246/19920166-2273-cmhsize-small.jpg', imgCredit: 'Cap badge, Canadian War Museum 19920166-2273', imgRecord: 'cwm-1075595' },
  { id: 'preston', kicker: 'Community · Halifax County', img: 'https://archives.novascotia.ca/images/africanns/200402256.jpg', imgCredit: 'Group with ox cart, Preston, ca. 1886 — Nova Scotia Archives', imgRecord: 'nsa-africanns-145' },
  { id: 'black-loyalists', kicker: 'Topic · 1783–1792', img: '' },
  { id: 'upper-hammonds-plains', kicker: 'Community · 1949 photographs', img: 'https://archives.novascotia.ca/images/africanns/200402295.jpg', imgCredit: 'Choir practice, Emmanuel Baptist Church, 1949 — Nova Scotia Archives', imgRecord: 'nsa-africanns-184' },
  { id: 'black-refugees', kicker: 'Topic · 1813–1834', img: '' },
  { id: 'guysborough', kicker: 'Place · ca. 1900 photographs', img: 'https://archives.novascotia.ca/images/africanns/200402268.jpg', imgCredit: 'Group of men in front of a barn, Guysborough, 1895 — Nova Scotia Archives', imgRecord: 'nsa-africanns-157' }
];
