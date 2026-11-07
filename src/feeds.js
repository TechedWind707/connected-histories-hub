/* =====================================================================
   feeds.js — RAW HARVEST SNAPSHOTS (one block per source institution)
   ---------------------------------------------------------------------
   These are the records exactly as each source publishes them, captured
   on 2026-11-07 from the institutions' own public search/exhibit pages.
   Field names are kept in each source's OWN vocabulary on purpose:
   the hub never edits these. normalize.js (the "crosswalk") reads them
   and builds the common model. Only metadata is held — no images, no
   full text, no copies of the collections themselves.

   Row arrays keep the file small; rows() turns them back into objects
   with the source's native field names.
   ===================================================================== */

// helper: turn [[a,b,c],...] into [{k1:a,k2:b,k3:c},...]
const rows = (keys, data) => data.map(r => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));

const FEEDS = {};

/* ---------------------------------------------------------------------
   SOURCE 1 — Nova Scotia Archives (provincial government archive)
   Shape: virtual-exhibit result lists. Each item has an exhibit ID,
   "Photographer/Author", "Credit" (who actually holds the original when
   it is not NSA) and a free-text "Reference". Themes = NSA's own grouping.
   ------------------------------------------------------------------- */
FEEDS.nsa = {
  harvested: '2026-11-07',
  method: 'Exhibit result pages (HTML) → extracted fields',
  harvestUrls: [
    'https://archives.novascotia.ca/africanns/results/?Search=&SearchList1=1',
    'https://archives.novascotia.ca/africanns/results/?Search=&SearchList1=2',
    'https://archives.novascotia.ca/africanns/results/?Search=&SearchList1=4',
    'https://archives.novascotia.ca/africanns/results/?Search=&SearchList1=5',
    'https://archives.novascotia.ca/desmond/results/?Search=&SearchList1=all'
  ],
  themes: {
    1: 'Slavery and Freedom, 1749-1782',
    2: 'Black Loyalists, 1783-1792',
    4: 'Black Refugees, 1813-1834',
    5: 'Descendants and Settlements: A Community Album, ca. 1879-1955',
    D: 'Viola Desmond'
  },
  records: rows(['Exhibit', 'ID', 'Title', 'Date', 'Photographer', 'Credit', 'Reference', 'Theme'], [
    // --- Theme 1: Slavery and Freedom, 1749-1782
    ['africanns', 1, 'A view of Halifax from the topmasthead', '25 January 1750', 'T. Jeffreys', '', 'Nova Scotia Archives T. Jeffreys, Untitled Map of Halifax (London, 1750)', 1],
    ['africanns', 2, 'Letter from Governor Cornwallis about Captain Bloss and his slaves', '22 September 1750', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 35 number 25 (microfilm 15231)', 1],
    ['africanns', 3, "A list of settlers victual'd at this place [Halifax] between the eighteenth day of May & fourth day of June 1750...", '28 November 1750', '', '', 'Isaac Deschamps Nova Scotia Archives MG 1 volume 258 number 12 (microfilm 14912)', 1],
    ['africanns', 4, 'Sale of a woman (age 35), two boys (ages 12 and 13), two male teenagers (ages 18), and a man (age 30)', '30 May 1752', '', '', 'Nova Scotia Archives Halifax Gazette 30 May 1752 page 2 (microfilm 8152)', 1],
    ['africanns', 5, 'Letter of Malachy Salter to his wife about a slave', '2 September 1759', '', '', 'Nova Scotia Archives MG 100 volume 217 number 27f (microfilm 9667)', 1],
    ['africanns', 6, 'A list of proprietors of the township of Liverpool with their number in family respectively', '[ca. 1764]', '', '', 'Commissioner of Crown Lands Nova Scotia Archives RG 20 series C volume 43 number 1', 1],
    ['africanns', 7, 'A general return of the several townships in the province of Nova Scotia the first day of January 1767', '16 December 1767', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 443 number 1 (microfilm 15479)', 1],
    ['africanns', 8, 'Deed from Barbary (Barbara) Cuffy to Robert Stevenson, Liverpool', '7 March 1769', '', '', 'Nova Scotia Archives Queens County deed registers volume 1 page 258 (microfilm 18606)', 1],
    ['africanns', 9, "Entry about the marriage of Deborah Cuffy and John Carroll, Liverpool from Simeon Perkins's diary, vol. 1 (typed transcript)", '4 May 1772', '', '', 'Simeon Perkins Nova Scotia Archives MG 1 volume 749', 1],
    ['africanns', 10, 'Fugitive slave advertisement', '1 September 1772', '', '', 'Nova Scotia Archives Nova Scotia Gazette and Weekly Chronicle 01 September 1772 page 3 (microfilm 8155)', 1],
    ['africanns', 11, 'Boy for sale', '28 March 1775', '', '', 'Nova Scotia Archives Nova Scotia Gazette and Weekly Chronicle 28 March 1775 page 3 (microfilm 8153)', 1],
    ['africanns', 12, "Bill of sale for slave named 'Dinah'", '19 November 1776', '', '', 'Nova Scotia Archives MG 100 volume 113 number 51 (microfilm 15169)', 1],
    ['africanns', 13, "Sale of slave 'Mintur' by Joseph Northup to John Palmer in Windsor", '1779', '', '', 'Nova Scotia Archives MG 100 volume 14 number 113 (microfilm 794)', 1],
    ['africanns', 14, 'Watson alias Phillis v. Proud (judgement)', '1779', '', '', 'Supreme Court of Nova Scotia — Halifax County judgement books Nova Scotia Archives RG 39 J Halifax County volume 6 page 103', 1],
    ['africanns', 15, "Bill of sale for slave 'Abram', recorded at the Colchester County Registry of Deeds", '29 July 1779', '', '', 'Nova Scotia Archives Colchester County register of deeds volume 1 page 468 (microfilm 17438)', 1],
    // --- Theme 2: Black Loyalists, 1783-1792
    ['africanns', 19, "David George's lease and passports, 1779-1781", 'Recorded in orderly book at Halifax, late 1782 or early 1783', '', 'Commissioner of Public Records Nova Scotia Archives', 'RG 1 volume 170 pages 332-3 (microfilm 15282)', 2],
    ['africanns', 20, "Certificates for Thomas Williams and his wife as 'freeborn Blacks', 1 July 1781", 'Recorded in orderly book at Halifax, late 1782 or early 1783', '', 'Commissioner of Public Records Nova Scotia Archives', 'RG 1 volume 170 page 333 (microfilm 15282)', 2],
    ['africanns', 21, "Certificate of Ned, his wife and family as 'free Negroes', 19 November 1779; passport of Ned, his wife and children, 14 October 1782", 'Recorded in orderly book at Halifax, 13 March 1783', '', 'Commissioner of Public Records Nova Scotia Archives', 'RG 1 volume 170 page 336 (microfilm 15282)', 2],
    ['africanns', 22, "Passport of Phillis Thomas, a 'free Black woman', 12 October 1782", 'Recorded in orderly book at Halifax, 14 March 1783', '', 'Commissioner of Public Records Nova Scotia Archives', 'RG 1 volume 170 page 338 (microfilm 15282)', 2],
    ['africanns', 23, "Certificate of Michael Thomas as a 'free Negro together with his wife and children', 24 July 1780", 'Recorded in orderly book at Halifax, 14 March 1783', '', 'Commissioner of Public Records Nova Scotia Archives', 'RG 1 volume 170 page 338 (microfilm 15282)', 2],
    ['africanns', 24, 'Passport for Cato Ramsay to emigrate to Nova Scotia', '21 April 1783', '', 'Gideon White family fonds Nova Scotia Archives', 'MG 1 volume 948 number 196 (microfilm 14960)', 2],
    ['africanns', 25, 'Passport and certificate of John Williams, 19 April 1783', 'Recorded in orderly book at Halifax, June or July 1783', '', 'Commissioner of Public Records Nova Scotia Archives', 'RG 1 volume 170 page 341 (microfilm 15282)', 2],
    ['africanns', 26, 'Book of Negroes', '[after 31 July 1783]', 'unknown', 'The National Archives, Kew (PRO)', 'Sir Guy Carleton Papers no. 10427 The National Archives, Kew PRO 30/55/100 (microfilm 10149)', 2],
    ['africanns', 27, "Certificate of manumission for 'James', a four month old 'mulatto child'", 'Recorded in orderly book at Halifax, October or November 1783', '', 'Commissioner of Public Records Nova Scotia Archives', 'RG 1 volume 170 page 350 (microfilm 15282)', 2],
    ['africanns', 28, 'Runaway slave advertisement', '9 December 1783', '', 'Nova Scotia Archives Nova Scotia Gazette and Weekly Chronicle 09 December 1783 page 4 (microfilm 8159)', '', 2],
    ['africanns', 29, 'Fortune — A Free Negro', '30 July 1784', '', 'Commissioner of Public Records Nova Scotia Archives', 'RG 1 volume 376 pages 52-3 (microfilm 15437)', 2],
    ['africanns', 30, 'Rose Fortune (ca. 1774-1864)', '[1830s?]', 'unknown', 'Nova Scotia Archives Documentary Art Collection: accession number 1979-147/56', '', 2],
    ['africanns', 31, 'Return of the disbanded troops and Loyalists settling in the Province of Nova Scotia, mustered in the summer 1784', '[after July 1784]', '', 'By Permission of The British Library', "The British Library King's Mss. 208 folio 23", 2],
    ['africanns', 32, 'Petition on behalf of the Black Pioneers', '20 (?) August 1784', '', 'Commissioner of Public Records Nova Scotia Archives', 'RG 1 volume 359 number 65 (microfilm 15428)', 2],
    ['africanns', 33, 'Return of Negroes and their families mustered in Annapolis County between the 28th day of May and the 30th day of June 1784', '5 September 1784', '', 'Commissioner of Public Records Nova Scotia Archives', 'RG 1 volume 376 pages 73-7 (microfilm 15437)', 2],
    // --- Theme 4: Black Refugees, 1813-1834
    ['africanns', 69, "List of 7 American slaves, deserted from the enemy — on board His Majesty's sloop Rifleman", '28 September 1813', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 420 number 1 (microfilm 15464)', 4],
    ['africanns', 70, "Admiral Cochrane's proclamation", '2 April 1814', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 111 pages 99-100 (microfilm 15262)', 4],
    ['africanns', 71, 'Ship news: several hundred black refugees arrive at Halifax on 1 September 1814', '3 September 1814', '', '', 'Nova Scotia Archives Acadian Recorder 3 September 1814 p.3 (microfilm 5193)', 4],
    ['africanns', 72, 'Melville Island military prison, Halifax, which served as temporary accommodation for African American refugees after the War of 1812', '29 May 1929', 'Gauvin & Gentzel', '', 'Nova Scotia Archives Photo Collection: Army: General', 4],
    ['africanns', 73, 'Return of black people at Halifax arrived from the Chesapeake', '[1815]', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 305 number 7 (microfilm 15387)', 4],
    ['africanns', 74, 'List of Blacks recently brought from the United States of America and settled on the Windsor Road', '[1815]', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 420 number 133 (microfilm 15464)', 4],
    ['africanns', 75, 'Return of black persons lately brought to the province from the United States...', '6 March 1815', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 411 number 78 (microfilm 15457)', 4],
    ['africanns', 76, 'Address of the House of Assembly to Lieutenant Governor Sherbrooke opposing black refugee immigration', '1 April 1815', '', '', 'Nova Scotia Archives Journal of the House of Assembly 1815 page 107 (microfilm 3528)', 4],
    ['africanns', 77, 'Contract between Lewis DeMolitor and the collector of customs for the port of Halifax to supply provisions for black refugees', '1 May 1815', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 420 number 17 (microfilm 15464)', 4],
    ['africanns', 78, 'Indenture of David Dize', '18 May 1815', '', '', 'Nova Scotia Archives MG 1 volume 770A number 57', 4],
    ['africanns', 79, 'Names of men of colour who are settled upon lands conveyed to them by Henry H. Cogswell...at the Head of the North West Arm', '2 November 1815', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 420 number 93 (microfilm 15464)', 4],
    ['africanns', 80, "Dr Head's report respecting black families settled at Preston", '1 February 1816', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 419 number 47 (microfilm 15460)', 4],
    ['africanns', 81, 'Report of lands cleared by the people of colour in the settlement of Preston...', '9 May 1816', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 421 number 3 (microfilm 15464)', 4],
    ['africanns', 82, 'Plot plan of lands at Preston', '19 November 1816', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 419 number 29', 4],
    ['africanns', 83, 'Letter From Lord Dalhousie to Earl Bathurst about the black refugees', '29 December 1816', '', '', 'Commissioner of Public Records Nova Scotia Archives RG 1 volume 112 pages 6-9 (microfilm 15262)', 4],
    // --- Theme 5: Descendants and Settlements, ca. 1879-1955
    ['africanns', 144, 'Looking up George Street, Halifax, on market day', '[ca. 1879]', 'Notman Studio', '', 'Notman Studio Nova Scotia Archives accession number 1983-310/44222', 5],
    ['africanns', 145, 'Group with ox cart, Preston, N.S.', '[ca. 1886]', 'attributed to Frances Jones Bannerman', '', 'Frances Jones Bannerman Nova Scotia Archives accession number 1996-156/12', 5],
    ['africanns', 146, '"Eddie Beals"', '[ca. 1890]', 'George H. Craig', 'Dartmouth Heritage Museum', 'George H. Craig Dartmouth Heritage Museum image number A8098; accession number 94.55.16', 5],
    ['africanns', 147, '"Saul Bauld, water carrier"', '[ca. 1890]', 'George H. Craig', 'Dartmouth Heritage Museum', 'George H. Craig Dartmouth Heritage Museum image number 8089; accession number 94.55.7', 5],
    ['africanns', 148, 'Selling baskets on market day, Halifax', '[ca. 1890]', 'George H. Craig', 'Dartmouth Heritage Museum', 'George H. Craig Dartmouth Heritage Museum image number A8289; accession number 94.55.207', 5],
    ['africanns', 149, 'Outdoor baptism, 1st Lake (Lake Banook), Dartmouth', '[1892]', 'George H. Craig', 'Black Cultural Centre', 'Black Cultural Centre', 5],
    ['africanns', 150, 'Edwin Howard Borden (1869-1953)', '1892', '', 'Esther Clark Wright Archives, Acadia University', 'Esther Clark Wright Archives, Acadia University accession number 1900.181/300', 5],
    ['africanns', 151, 'Gabriel Hall', 'March 1892', 'George H. Craig', '', 'George H. Craig Nova Scotia Archives accession number 1988-387', 5],
    ['africanns', 152, 'William Hall, VC (1829-1904)', '[ca. 1895]', 'unknown', '', 'C. Bruce Fergusson Nova Scotia Archives accession number 1980-030', 5],
    ['africanns', 153, 'James R. Johnston (1876-1915)', '[ca. 1898]', 'Notman Studio', '', 'Notman Studio Nova Scotia Archives accession number 1983-310/2573', 5],
    ['africanns', 154, 'Halifax children', '[ca. 1898]', 'J.A. Irvine', '', 'J.A. Irvine Nova Scotia Archives Photo album 37/122', 5],
    ['africanns', 155, "Couple posing in their cooks' aprons at the YMCA Maritime Boys Camp, Cow Bay, near Silver Sands Beach", '[ca. 1900]', 'J.A. Irvine', '', 'J.A. Irvine Nova Scotia Archives Photo album 37/54', 5],
    ['africanns', 156, 'Black vendors at the Halifax Market', '[ca. 1900]', 'unknown', 'History Collection, Nova Scotia Museum', 'Nova Scotia Museum photo 78.15', 5],
    ['africanns', 157, 'Group of men posing in front of a barn at Guysborough', '1895', 'William H. Buckley', '', 'Buckley family Nova Scotia Archives accession number 1985-386/33', 5],
    ['africanns', 158, 'Nanny with the children in her care, Guysborough', '[ca. 1900]', 'William H. Buckley', '', 'Buckley family Nova Scotia Archives accession number 1985-386/216', 5],
    ['africanns', 159, 'Man lighting his pipe, Guysborough', '[ca. 1900]', 'William H. Buckley', '', 'Buckley family Nova Scotia Archives accession number 1985-386/43', 5],
    ['africanns', 160, 'John Bowden, Guysborough', '[ca. 1900]', 'William H. Buckley', '', 'Buckley family Nova Scotia Archives accession number 1985-386/82', 5],
    ['africanns', 161, "'Joe Izzard playing the fiddle (copy for J. Bowden)'", '[ca. 1900]', 'William H. Buckley', '', 'Buckley family Nova Scotia Archives accession number 1985-386/881', 5],
    ['africanns', 162, 'Eliza Brody in her home at Sunnyville, Guysborough County', '[ca. 1905]', 'William H. Buckley', '', 'Buckley family Nova Scotia Archives accession number 1985-386/26', 5],
    ['africanns', 163, 'Church picnic, Weymouth Falls', '[ca. 1900]', 'unknown', 'Dalhousie University Archives', 'G. D. Campbell Photograph Collection Dalhousie University Archives PC4, Box 1, Folder 2', 5],
    ['africanns', 164, 'Una Gibson, Shelburne', '[ca. 1900]', 'unknown', 'Black Cultural Centre', 'Black Cultural Centre', 5],
    ['africanns', 165, "Edward 'Ned' Beals, Preston", '[ca. 1890]', 'George H. Craig', 'Dartmouth Heritage Museum', 'George H. Craig Photograph Collection, 1885 - 1894 Dartmouth Heritage Museum image number A562; accession number 92.7.189', 5],
    ['africanns', 166, "'School at Five Mile Plains where Miss DeWolf taught around 1912'", '[ca. 1912]', 'Miss DeWolf?', '', 'Nova Scotia Archives L. DeW. Rathbun, First Freed Slaves at Five Mile Plains and Vicinity (typescript, 1950), ill. number 4 (GN / R18)', 5],
    ['africanns', 167, "'James Croxen and some members of his family'", '[ca. 1912]', 'unknown', '', 'Nova Scotia Archives L. DeW. Rathbun, First Freed Slaves at Five Mile Plains and Vicinity (typescript, 1950), ill. number 1 (GN / R18)', 5],
    ['africanns', 168, "'Rita Sampson, 7th generation of Hoping Bowen and Samuel Johnson'", '[ca. 1950]', 'unknown', '', 'Nova Scotia Archives L. DeW. Rathbun, First Freed Slaves at Five Mile Plains and Vicinity (typescript, 1950), ill. number 7 (GN / R18)', 5],
    ['africanns', 169, "'Mary David born August 9, 1866, great-grandaughter of Samuel Johnson, granddaughter of Pompey Johnson and daughter of Ellen Clark, taken at Five Mile Plains, October 15, 1951'", '1951', 'unknown', '', 'Nova Scotia Archives L. DeW. Rathbun, First Freed Slaves at Five Mile Plains and Vicinity (typescript, 1950), ill. number 8 (GN /R18)', 5],
    ['africanns', 170, 'Thomas Beals family of North Preston', '[1930s]', 'Clara Dennis', '', 'Clara Dennis Nova Scotia Archives accession number 1983-468/106', 5],
    ['africanns', 171, "'John Farmer, descendent of Jupiter the slave, Birchtown, Shelburne County'", '[early 1930s]', 'Clara Dennis', '', 'Clara Dennis Nova Scotia Archives accession number 1983-468/33', 5],
    ['africanns', 172, "Houses belonging to the Colley family, on the site of Governor's Farm, Preston", '2 October 1934', 'Gauvin & Gentzel', '', 'Nova Scotia Archives Photo Collection: Places: Preston', 5],
    ['africanns', 173, 'Scene at North Preston, showing the Baptist church', '2 October 1934', 'Gauvin & Gentzel', '', 'Nova Scotia Archives Photo Collection: Places: Preston', 5],
    ['africanns', 174, 'House at North Preston, with group of children in the foreground', '2 October 1934', 'Gauvin & Gentzel', '', 'Nova Scotia Archives Photo Collection: Places: Preston', 5],
    ['africanns', 175, 'Sign from the Stag Inn, Preston', '[1840s or 1850s]', '', 'History Collection, Nova Scotia Museum', 'Nova Scotia Museum accession number 34-211', 5],
    ['africanns', 176, 'House at Preston, formerly the Stag Inn', '2 October 1934', 'Gauvin & Gentzel', '', 'Nova Scotia Archives Photo Collection: Places: Preston', 5],
    ['africanns', 177, 'African Methodist Episcopal Zion Church (newspaper clipping)', '12 September 1938', '', '', 'Nova Scotia Archives "Make Appeal In Behalf Of Church", Halifax Mail 12 September 1938 p.2 (microfilm 7288)', 5],
    ['africanns', 178, "'Winter on Hollis Steet, Halifax, N.S., Christmas trees'", '[ca. 1947]', 'Robert Norwood', '', 'Robert Norwood Nova Scotia Archives accession number 1987-480/263', 5],
    ['africanns', 179, 'William Riley, with his daughter Rose standing behind him in the doorway, Cherry Brook', '1948', 'attributed to Helen Creighton', '', 'Helen Creighton Nova Scotia Archives accession number 1987-178/14-124', 5],
    ['africanns', 180, "'Charlie Symonds, a cooper of Upper Hammonds Plains'", '1949', 'C.R. Brookbank', '', 'Nova Scotia Archives C.R. Brookbank, Afro-Canadian Communities in Halifax County, Nova Scotia (unpublished MA thesis, University of Toronto, 1949), page 38 (HT431 /B871 /A259)', 5],
    ['africanns', 181, 'Young boy in front of a pile of finished barrel staves at the Anderson sawmill near Hammonds Plains', '1949', 'C.R. Brookbank', '', 'Nova Scotia Archives C.R. Brookbank, Afro-Canadian Communities in Halifax County, Nova Scotia (unpublished MA thesis, University of Toronto, 1949), page 41 (HT431 /B871 /A259)', 5],
    ['africanns', 182, "A.W. Evans' farm, Preston, with a view of the piggery", '1949', 'C.R. Brookbank', '', 'Nova Scotia Archives C.R. Brookbank, Afro-Canadian Communities in Halifax County, Nova Scotia (unpublished MA thesis, University of Toronto, 1949), page 21 (HT431 /B871 /A259)', 5],
    ['africanns', 183, 'Operating the circular saw at the Anderson sawmill near Hammonds Plains', '1949', 'C.R. Brookbank', '', 'Nova Scotia Archives C.R. Brookbank, Afro-Canadian Communities in Halifax County, Nova Scotia (unpublished MA thesis, University of Toronto, 1949), page 41 (HT431 /B871 /A259)', 5],
    ['africanns', 184, 'Group of women (and one man) dressed for choir practice at Emmanuel Baptist Church, Upper Hammonds Plains', '1949', 'C.R. Brookbank', '', 'Nova Scotia Archives C.R. Brookbank, Afro-Canadian Communities in Halifax County, Nova Scotia (unpublished MA thesis, University of Toronto, 1949), page 66 (HT431 /B871 /A259)', 5],
    ['africanns', 185, 'Mrs. Johnson and two young boys, Upper Hammonds Plains', '1949', 'C.R. Brookbank', '', 'Nova Scotia Archives C.R. Brookbank, Afro-Canadian Communities in Halifax County, Nova Scotia (unpublished MA thesis, University of Toronto, 1949), page 65 (HT431 /B871 /A259)', 5],
    ['africanns', 186, 'One of the youngest residents of Upper Hammonds Plains', '1949', 'C.R. Brookbank', '', 'Nova Scotia Archives C.R. Brookbank, Afro-Canadian Communities in Halifax County, Nova Scotia (unpublished MA thesis, University of Toronto, 1949), page 65 (HT431 /B871 /A259)', 5],
    ['africanns', 187, 'House, Upper Hammonds Plains', '1949', 'C.R. Brookbank', '', 'Nova Scotia Archives C.R. Brookbank, Afro-Canadian Communities in Halifax County, Nova Scotia (unpublished MA thesis, University of Toronto, 1949), page 19 (HT431 /B871 /A259)', 5],
    ['africanns', 188, 'Community Hall, Upper Hammonds Plains', '1949', 'C.R. Brookbank', '', 'Nova Scotia Archives C.R. Brookbank, Afro-Canadian Communities in Halifax County, Nova Scotia (unpublished MA thesis, University of Toronto, 1949), page 15 (HT431 /B871 /A259)', 5],
    // --- Viola Desmond exhibit (court records, 1946-1947)
    ['desmond', 1, 'Information and complaint', '8 November 1946', '', '', 'Nova Scotia Archives RG 39 C volume 937 Supreme Court 13347', 'D'],
    ['desmond', 2, "[Stipendiary] Magistrate's record of proceedings", '9 November 1946', '', '', '', 'D'],
    ['desmond', 3, 'Receipt that notes payment of fine', '9 November 1946', '', '', '', 'D'],
    ['desmond', 4, 'Recognizance for Writ of Certiorari to move conviction of Stipendiary Magistrate into Supreme Court', '24 December 1946', '', '', '', 'D'],
    ['desmond', 5, 'Notice of Motion, affidavits of Viola Desmond, other affidavit, and exhibits for Writ of Certiorari - to be heard 10 January 1947', '27 December 1946', '', '', '', 'D'],
    ['desmond', 6, 'Letter, Rod[erick] G MacKay, Stipendiary Magistrate, enclosing original documents outlined above', '2 January 1947', '', '', '', 'D'],
    ['desmond', 10, 'Decision of Justice Archibald regarding Writ of Certiorari', '20 January 1947', '', '', '', 'D'],
    ['desmond', 11, "Letter, Deputy Prothonotary to E.M. MacDonald, New Glasgow, sending copy of Archibald's Decision", '20 January 1947', '', '', '', 'D'],
    ['desmond', 12, 'Letter, F.W. Bissett to Deputy Prothonotary, enclosing Notice of appeal', '21 January 1947', '', '', '', 'D'],
    ['desmond', 13, 'Notice of Appeal of Decision of Justice Archibald (dated 20 January 1947)', '22 January 1947', '', '', '', 'D'],
    ['desmond', 14, 'Affidavit of Viola Desmond in support of her appeal', '29 January 1947', '', '', '', 'D'],
    ['desmond', 15, 'Entry of Appeal (dated 21 February 1947)', '22 February 1947', '', '', '', 'D'],
    ['desmond', 16, 'Letter, E.M. MacDonald, New Glasgow, enclosing 3 copies of Factum', '10 March 1947', '', '', '', 'D'],
    ['desmond', 17, 'Decision of Justice Graham on Appeal (dated 28 March 1947)', '17 May 1947', '', '', '', 'D'],
    ['desmond', 18, 'Opinion of Justice Doull (dated 5 April 1947)', '17 May 1947', '', '', '', 'D'],
    ['desmond', 19, 'Opinion of Justice Carroll (dated 18 April 1947)', '17 May 1947', '', '', '', 'D']
  ])
};

/* ---------------------------------------------------------------------
   SOURCE 2 — Library and Archives Canada (federal archive & library)
   Shape: Collection Search result rows. Keyed by app + IdNumber.
   Uses archival vocabulary: "Hierarchical level", "Type of material".
   ------------------------------------------------------------------- */
FEEDS.lac = {
  harvested: '2026-11-07',
  method: 'Collection Search result pages → extracted fields',
  harvestUrls: [
    'https://recherche-collection-search.bac-lac.gc.ca/eng/Home/Result?q_any=Africville&DataSource=Archives',
    'https://recherche-collection-search.bac-lac.gc.ca/eng/Home/Result?q_any=%22Construction%20Battalion%22%20No.%202&DataSource=Archives',
    'https://recherche-collection-search.bac-lac.gc.ca/eng/Home/Result?q_any=Viola%20Desmond',
    'https://recherche-collection-search.bac-lac.gc.ca/eng/Home/Result?q_any=Birchtown&DataSource=Archives'
  ],
  records: rows(['app', 'IdNumber', 'Title', 'Date', 'TypeOfMaterial', 'HierarchicalLevel', 'Reference', 'FoundIn', 'Unit'], [
    // Africville
    ['fonandcol', 3347829, 'Africville', 'n.d.', 'Photographs', 'File', 'Box number: 6262', 'Archives / Collections and Fonds'],
    ['fonandcol', 3585876, 'Africville', 'n.d.', 'Photographs', 'Item', 'Box number: TCS 00166', 'Archives / Collections and Fonds'],
    ['fonandcol', 5145997, 'Africville', 'ca. 1964', 'Photographs', 'Item (Accession level)', 'Accession number: 1981-181 NPC, Box number: TCS 00166', 'Archives / Collections and Fonds'],
    ['fonandcol', 3596781, 'Aerial view of Africville', 'ca. 1964', 'Photographs', 'Item', 'Box number: TCS 00166', 'Archives / Collections and Fonds'],
    ['fonandcol', 3795248, 'Africville - clipping', '2004', 'Textual material', 'File', 'R12294-537-1-E, Volume number: 13', 'Archives / Collections and Fonds'],
    ['fonandcol', 6308218, 'Halifax - Africville', '1940-1952', 'Textual material', 'File (Accession level)', 'R226, RG28, Box number: 18, File number: M-298', 'Archives / Collections and Fonds'],
    ['fonandcol', 3238299, 'Slums of Africville', 'c.a. 1958', 'Photographs', 'Item (Accession level)', 'Accession number: 1975-330 NPC, Box number: 5142', 'Archives / Collections and Fonds'],
    ['fonandcol', 3238300, 'Slums of Africville', 'c.a. 1958', 'Photographs', 'Item (Accession level)', 'Accession number: 1975-330 NPC, Box number: 5142', 'Archives / Collections and Fonds'],
    ['fonandcol', 3238301, 'Slums of Africville', 'c.a. 1958', 'Photographs', 'Item (Accession level)', 'Accession number: 1975-330 NPC, Box number: 5142', 'Archives / Collections and Fonds'],
    ['fonandcol', 3345617, 'Views of Africville', '14 Sept. 1965', 'Photographs', 'File', '', 'Archives / Collections and Fonds'],
    ['fonandcol', 5626954, '033155 Africville Genealogy Society', '2005/11/25-2009/10/02', 'Textual material', 'File (Accession level)', 'R2103, Box number: 1, File number: 6004-189769', 'Archives / Collections and Fonds'],
    ['fonandcol', 3727861, 'Africville - meeting - notes - clippings', 'Jan. 1960-Oct. 1962', 'Textual material', 'File', 'R12287-31-6-E, Volume number: 1', 'Archives / Collections and Fonds'],
    ['fonandcol', 3347431, 'Canadian Negro Boy - Africville', 'n.d.', 'Photographs', 'File', '', 'Archives / Collections and Fonds'],
    ['fonandcol', 3232798, 'Africville - Black community - street scene', '14 Sept. 1965', 'Photographs', 'Item', 'Box number: 6245', 'Archives / Collections and Fonds'],
    ['fonandcol', 3232799, 'Africville - Black community - street scene', '14 Sept. 1965', 'Photographs', 'Item', 'Box number: 6245', 'Archives / Collections and Fonds'],
    ['fonandcol', 3232805, 'Africville - Black community - young girl', '14 Sept. 1965', 'Photographs', 'Item', 'Box number: 6245', 'Archives / Collections and Fonds'],
    // No. 2 Construction Battalion
    ['fonandcol', 1888452, 'NO 2 CONSTRUCTION BATTALION', '1916-1917', 'Textual material', 'File', 'RG24-C-1-a, Volume number: 1374, File number: HQ-593-6-1CONST-2, File part: 1', 'Archives / Collections and Fonds'],
    ['fonandcol', 1888467, 'NO 2 CONSTRUCTION BATTALION', '1916-1918', 'Textual material', 'File', 'RG24-C-1-a, Volume number: 1469, File number: HQ-600-10-35, File part: 1', 'Archives / Collections and Fonds'],
    ['fonandcol', 2013790, 'No. 2 Construction Battalion', '1918/04/17', 'Textual material', 'File', 'RG9-II-B-9, Volume number: 50, File number: 1223A', 'Archives / Collections and Fonds'],
    ['fonandcol', 2014295, 'No. 2 Construction Battalion', '1914-1918', 'Textual material', 'File', 'RG9-II-B-10, Volume number: 45', 'Archives / Collections and Fonds'],
    ['fonandcol', 2013333, 'No. 2 Construction Battalion', '1917/03/28', 'Textual material', 'File', 'RG9-II-B-9, Volume number: 39, File number: 748', 'Archives / Collections and Fonds'],
    ['fonandcol', 4352032, 'No. 2 Construction Battalion', '', 'Textual material', 'File', 'RG 9 III-B-1, Volume number: 1147, File number: R-175-4', 'Archives / Collections and Fonds'],
    ['fonandcol', 1890812, 'NO 2 CONSTRUCTION BATTALION - BADGES', '1916', 'Textual material', 'File', 'RG24-C-1-a, Volume number: 1695, File number: HQ-683-401-4, File part: 1', 'Archives / Collections and Fonds'],
    ['fonandcol', 1889306, 'NO 2 CONSTRUCTION BATTALION - BAND', '1916-1917', 'Textual material', 'File', 'RG24-C-1-a, Volume number: 1550, File number: HQ-683-124-2, File part: 1', 'Archives / Collections and Fonds'],
    ['fonandcol', 1890817, 'NO 2 CONSTRUCTION BATTALION - DEMOBILIZATION', '1919-1922', 'Textual material', 'File', 'RG24-C-1-a, Volume number: 1695, File number: HQ-683-401-9, File part: 1', 'Archives / Collections and Fonds'],
    ['fonandcol', 1092304, 'NO 2 CONSTRUCTION BATTALION ORGANIZATION', '1916-1917', 'Textual material', 'File', 'RG24-C-8, Volume number: 4393, File number: MD2-34-7-171, File part: 1', 'Archives / Collections and Fonds'],
    ['fonandcol', 1093815, 'MOBILIZATION - NO 2 CONSTRUCTION BATTALION, CEF', '1916-1917', 'Textual material', 'File', 'RG24, Volume number: 4642, File number: MD11-99-4-63, File part: 1', 'Archives / Collections and Fonds'],
    ['fonandcol', 1890815, 'NO 2 CONSTRUCTION BATTALION - EPIDEMIC OF PNEUMONIA', '1917', 'Textual material', 'File', 'RG24-C-1-a, Volume number: 1695, File number: HQ-683-401-7, File part: 1', 'Archives / Collections and Fonds'],
    ['fonandcol', 1890816, 'NO 2 CONSTRUCTION BATTALION - PAY AND PAYSHEETS', '1916-1918', 'Textual material', 'File', 'RG24-C-1-a, Volume number: 1695, File number: HQ-683-401-8, File part: 1', 'Archives / Collections and Fonds'],
    ['fonandcol', 2009988, 'No.2 Construction Battalion - After Orders', '1921/06-1923/03', 'Textual material', 'File', 'RG9-II-B-11, Volume number: 11', 'Archives / Collections and Fonds'],
    ['fonandcol', 2008927, 'Military District 6 - No. 2 - Construction Battalion (Daily Orders)', '1916/10-1917/03', 'Textual material', 'File', 'RG9-II-F-9, Volume number: 1080', 'Archives / Collections and Fonds'],
    ['pffww', 185378, 'MITCHELL, JOHN', '', 'Textual material', 'File', 'RG 150, Accession 1992-93/166, Box 6257 - 35', 'Genealogy / Military / First World War Personnel Records', 'No. 2 Construction Battalion'],
    // Viola Desmond
    ['fonandcol', 1125534, 'Desmond, Viola I. (Mrs.)', '1954/08-1955/09', 'Textual material', 'File', 'RG117, Volume number: 489, File number: BBW 10040', 'Archives / Collections and Fonds'],
    ['fonandcol', 4341191, 'John Ware and Viola Desmond = John Ware et Viola Desmond', '1 Feb. 2012', 'Stamps and stamp products', 'File', 'R169-2571-2-E, Volume number: 4025', 'Archives / Collections and Fonds'],
    ['fonandcol', 4341281, 'Viola Desmond [philatelic record] / design, Lara Minja (lime Design Inc)', '16 Feb. 2012', 'Stamps and stamp products', 'Item', 'R169-2589-X-E, Volume number: 4025', 'Archives / Collections and Fonds'],
    ['fonandcol', 4936390, 'Completed evaluation forms for the book "Viola Desmond Won\'t be Budged"', '2011-2012', 'Textual material', 'File', 'R15555-661-4-E, Volume number: 51', 'Archives / Collections and Fonds'],
    ['oclc', 1080217412, 'Viola Desmond : her life and times / Graham Reynolds, Wanda Robson.', '2018', 'Book', '', '', 'Library / National Library Collections'],
    // Birchtown / Shelburne (Black Loyalist settlement area)
    ['fonandcol', 101267, 'Shelburne historical records collection [textual record]', '1782-1860', 'Textual material', 'Fonds/Collection', 'R16987-0-X-E, MG9-B9-14', 'Archives / Collections and Fonds'],
    ['fonandcol', 115410, 'Port Roseway Associates [textual record]', '1782-1787', 'Textual material', 'Series', 'MG9-B9-14', 'Archives / Collections and Fonds'],
    ['filvidandsou', 606853, 'Adrienne Clarkson: Birchtown Video Rough Cut', '2003', 'Moving images', 'Item (Accession level)', '', 'Archives / Film, video and sound']
  ])
};

/* ---------------------------------------------------------------------
   SOURCE 3 — Canadian War Museum (national museum)
   Shape: museum object records (artifact number, materials, military
   unit, people, places, description, thumbnail).
   ------------------------------------------------------------------- */
FEEDS.cwm = {
  harvested: '2026-11-07',
  method: 'Collection advanced search (facet: military unit) + artifact pages',
  harvestUrls: ['https://www.warmuseum.ca/collections/advanced-search?military.unit=no.+2+construction+battalion&page=1&type=artifact&view=list'],
  records: rows(['irn', 'objectName', 'artifactNumber', 'date', 'materials', 'militaryUnit', 'people', 'places', 'description', 'thumbnail'], [
    [1075595, 'Cap Badge', '19920166-2273', '1917-1920', 'bronze', 'No. 2 Construction Battalion', '', '', 'Inscription (obverse/avers): CANADA / OVERSEAS / No 2 CONSTRCTION', 'https://www.warmuseum.ca/ke/_resources/5401246/19920166-2273-cmhsize-small.jpg'],
    [2551834, 'Medal Set', '20120205-001', '1914-1918', 'bronze', 'No. 2 Construction Battalion', 'PTE. R.A. YOUNG', 'United Kingdom', 'This medal set belongs to Private R.A. Young of the No. 2 Construction Battalion, made during the First World War, a time marked by significant global conflict between 1914 and 1919.', 'https://www.warmuseum.ca/ke/_resources/5528008/20120205-001-cmhsize-small.jpg'],
    [3559536, 'Medallion', '20230036-001', '2022', 'metal, synthetic fibre', 'No. 2 Construction Battalion', '', 'Canada', 'National Apology Event/In recognition of/service and sacrifice/July 9, 2022', 'https://www.warmuseum.ca/ke/_resources/5834341/20230036-001-cmhsize-small.jpg'],
    [2573507, 'Quilt, Legacy Shadow Quilt', '20170024-001', '2016/07', 'cotton', 'No. 2 Construction Battalion', '', 'North America – Canada – Dartmouth – Nova Scotia', 'Celebrating 100 Anniversary of the: No. 2 CONSTRUCTION BATTALION July 2016 QUILTED BY: OZELL M. BORDEN', 'https://www.warmuseum.ca/ke/_resources/5635468/20170024-001-cmhsize-small.jpg']
  ])
};

/* ---------------------------------------------------------------------
   SOURCE 4 — Halifax Municipal Archives (municipal archive)
   Shape: a published SOURCE GUIDE web page — exactly the kind of
   "information buried in finding aids and websites" the brief mentions.
   Each entry = a record series with its reference code and date span.
   ------------------------------------------------------------------- */
FEEDS.hma = {
  harvested: '2026-11-07',
  method: 'Source-guide web page → one entry per described series',
  harvestUrls: ['https://www.halifax.ca/about-halifax/municipal-archives/source-guides/africville-sources'],
  guideIntro: "This source guide provides descriptions of the municipal material related to the community of Africville along with digital copies of those records. Municipal records tell the story of Africville's relationship with the City of Halifax.",
  records: rows(['anchor', 'heading', 'refCode', 'span', 'scope'], [
    ['Council', 'City Council and Board of Control minutes and submissions, 1860-2010', '102-1A, 102-1B', '1860-2010', "From the first mention of Africville in 1860 through to Regional Council's historic reparation agreement in 2010, Council minutes help track interactions between the Africville community and the municipal government."],
    ['HousingSurvey', 'Responses to housing survey from Africville residents, 1944', '102-36D', '1944', "A Census and Building Survey of Halifax and Dartmouth was conducted by wartime administrators to address the acute housing shortage. The Africville section provides a valuable census of who was living there and their housing situation."],
    ['Master', 'Master Plan for City of Halifax, 1945', '711.45 .H17', '1945', "The 1945 Master Plan was the City of Halifax's first effort at coordinated planning. The plan recommended removing the 'Africville Settlement' and providing residents 'with a decent minimum standard of housing elsewhere'."],
    ['Stephenson', 'Stephenson Redevelopment Study, 1957', '711.45 .S8', '1957', "The Stephenson Report recommended a programme of urban renewal for Halifax, including removal of the Africville 'slum.'"],
    ['Rose', 'Rose Report, 1963', '971.6225H', '1963', 'The Rose Report was written by Dr. Albert Rose, a Social Work and Welfare Specialist from the University of Toronto, after he was sent to visit and review the community of Africville. The report recommended expropriation with full compensation and assistance with relocation.'],
    ['Clerk', "Halifax City Clerk's records, 1920-1990", '102-5', '1920-1990', "Files related to Africville kept by the Clerk include Acquisition of Property and Deeds case files, the City Clerk's expropriation file on Africville, and a subject file on the artesian well at Africville."],
    ['Manager', "Halifax City Manager's records, 1954-1994", '102-4', '1954-1994', 'The City Manager kept subject files on many significant issues. These three files about Africville are rich in documentation, including maps and plans.'],
    ['HRMCAO', "HRM Chief Administrative Officer's records, 1996-2015", '400-14-814-1996', '1996-2015', 'Records related to the action taken against HRM by the Africville Genealogy Society, including discussions of a land transfer at Seaview Park and the rebuilding of the Seaview Baptist Church.'],
    ['HRMMayor', "HRM Mayor's Office subject files, 1996-2009", '400-11-2-1996-3', '1996-2009', 'Correspondence with the provincial government and the Africville Genealogical Society about the lands and location for the Africville memorial, and the Africville Educational Fund.'],
    ['Redevelopment', "Redevelopment Committee's Africville Sub-committee records, 1963-1968", '102-42C', '1963-1968', 'The Africville Sub-committee was established in 1964 as an advisory committee consisting of council members, city staff, and members of the Halifax Human Rights Advisory Committee. Its purpose was to advise council on how to implement the Rose Report.'],
    ['Advisory', 'Halifax Advisory Committee on Human Rights records, 1954-2004', 'CR5', '1954-2004', 'Donated by committee members Gus Wedderburn and Donald Maclean. Includes meeting minutes, 1962-1967, and a 1962 Survey of Africville Residents, anonymized.'],
    ['compensation', 'Africville Relocation Program compensation case files, 1964-1971', '102-133', '1964-1971', 'Case files in which social worker Peter J. MacDonald gathered the documentation used to recommend the level of compensation and the type of support offered to each property owner in Africville.'],
    ['followupprogram', 'Africville Follow-up Program records, 1969-1971', '102-134', '1969-1971', 'In 1969 staff from the Social Planning Department began a program focused on housing and employment for relocated Africville residents, including an Africville Action Committee on Employment.'],
    ['committeerecords', 'Africville Committee records, 1993-1996', '102-135', '1993-1996', 'In the fall of 1994, Halifax City Council agreed to establish a committee to meet with members or representatives of the Africville and local black community in order to achieve closure on the issues surrounding the expropriation of the lands in the community.'],
    ['Permits', 'Building Permits, 1934-1968', '102-39I-29', '1934-1968', 'These building permit records show applications for new construction, renovations or demolitions in Africville.'],
    ['School', 'Board of School Commissioners records, 1865-1953', '102-53', '1865-1953', 'From details about the original Campbell Road School in the 1860s, to the closure of the Africville School in 1952, the records of the Halifax Board of School Commissioners provide evidence of the education of the children of Africville.'],
    ['Seaview', 'Seaview Park, 1976-1991', '102-105-3', '1976-1991', 'In 1979 City Council approved the creation of a public park in part of Africville. The park was named Seaview Park, but did not officially open until 1985.'],
    ['NewsRelease', 'Africville Apology, 2010', '400-22-1-1-2010-2-24', '2010', 'Photographs and audiovisual recordings of the Africville: Recognizing the Past, Present, and Future event, which took place at the Community YMCA on Gottingen Street on February 24, 2010. This event included an official apology to the former residents of Africville.'],
    ['Directories', 'Halifax City Directories, 1892-1961', '', '1892-1961', 'A searchable compilation of excerpts from Halifax street directories, 1892-1961, that list the residents of Africville.'],
    ['Flickr', 'Photographs of Africville', '', '', "The photographs of Africville held by the Municipal Archives have been digitized and are available in a Flickr album. They represent the municipal government's view of the area."]
  ])
};
