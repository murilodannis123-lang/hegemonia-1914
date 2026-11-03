// Acervo de fotos reais da Primeira Guerra (Wikimedia Commons, domínio público).
// Carregadas direto do Commons pelo navegador do jogador.
const P = {
  trincheira: ['Cheshire Regiment trench Somme 1916.jpg', 'Breastwork trench at Armentieres 1916.jpg', 'Lancashire Fusiliers trench Beaumont Hamel 1916.jpg', 'Stretcher bearers Battle of Thiepval Ridge September 1916.jpg', 'French trench battle.jpg'],
  infantaria: ['British infantry advancing at Loos 25 September 1915.jpg', '7th Division advance Somme 01-07-1916 IWM Q 89.jpg'],
  artilharia: ['FrankHurleyAustralian8inchHowitzerBattery.jpg', 'BL12inchRailwayHowitzerMkI.jpg', '12inchRailwayHowitzerHildaYpres7November1917.jpeg', 'Australian8inchHowitzerFiringYpres15September1917.jpeg', '12inchMkVRailwayHowitzerFiringSoissons1917.jpeg'],
  tanque: ['Wrecked captured Mark I series tank.jpg', 'Captured Mark IV series tank.jpg', 'Mark IV supply tank AWM C04889.jpeg', 'Mark IV Berlin.jpg'],
  aviao: ['StateLibQld 1 149795 De Havilland two seater biplane at Point Cook during World War I, ca. 1915.jpg', 'AEG C.IV biplane in Palestine 1917.jpg', 'Cody Michelin Cup biplane RAE-O80.jpg', 'Captured German bomber aircraft at Cologne 1918.jpg', 'StateLibQld 2 118648 Pilot starting out in his biplane in the Middle East, World War I.jpg'],
  zepelim: ['Wrecked zep. (zeppelin) in France LOC 27036595622.jpg', 'Eerste Wereldoorlog Luchtoorlog Duitse soldaten houden een zeppelin, luchtschip vast met, SFA022802325.jpg', 'Eerste Wereldoorlog Luchtoorlog Gondel onder een Franse zeppelin, luchtschip, SFA022802326.jpg', 'Eerste Wereldoorlog Luchtoorlog Een Franse zeppelin, Frans luchtschip wordt door een Duits, SFA022802327.jpg'],
  navio: ['HMS Britannia.jpg', 'British Battleships of the First World War; HMS Dreadnought Q38705.jpg', 'British Battleships of the First World War; HMS Dreadnought Q21183.jpg', 'Pre- Dreadnought Battleships of the Royal Navy Q65816.jpg'],
  submarino: ['U 20 grounded Denmark 1916.JPG', 'U-Boot Deutschland 1916.jpg', 'German submarine SM U-53.jpg', 'Surrendered German U-boat in London, 1918 Q46047.jpg'],
  cavalaria: ['Austro-Hungarian cavalry entering Bucharest, 6 December 1916.jpg', 'The camel corps at Beersheba2.jpg', 'British cavalry 1917.jpg', 'British cavalry Cambrai 1917.jpg'],
  ruinas: ['Ruins of Ypres in the sunlight.jpg', 'Shell Explosion Cathedral at Rheims.jpg'],
  diplomacia: ['Paris 1919 Australian delegation.jpg', 'Big four.jpg', 'Hughes Welcomehome Parispeaceconference.jpg', 'Treaty of Versailles Signing, Hall of Mirrors.jpg'],
  multidao: ['Crowd and mobilization (1914).jpg', "Reservists at Gare de L'est, Paris (LOC).jpg", 'Crowd cheers the Kaiser at the Berliner Stadtschloss, 1914.jpg', 'Lecture des affiches 1914.jpg', 'Višnja Gora in 1914.jpg'],
  fabrica: ['Women workers with shells in Chilwell filling factory 1917 IWM Q 30040.jpg', 'Women with shells at Chilwell 1917 IWM Q 30017.jpg', '12 inch shells at Chilwell 1917 IWM Q 30041.jpg', 'Industry during the First World War Q54668.jpg'],
  prisioneiros: ['German Prisoners of War in Britain during the First World War Q53380.jpg', 'German Prisoners of War in the United Kingdom during the First World War Q53480.jpg'],
  revolta: ['19170704 Riot on Nevsky prosp Petrograd.jpg'],
  generais: ['Ministry of Information First World War Official Collection Q25847.jpg', 'British troops in Baghdad, Iraq on March 11, 1917 during World War I LOC 28800080870.jpg'],
  trem: ['Ministry of Information First World War Official Collection Q25795.jpg', 'Ministry of Information First World War Official Collection Q25796.jpg', 'Ministry of Information First World War Miscellaneous Collection Q33550.jpg'],
  desfile: ['London Victory Parade July 1919 IWM Q 28765.jpg', 'Victory Parade in London, 19 July 1919 Q67721.jpg', '1919 - World War I Victory Parade - Victory Arch - 500 Block Hamilton Street - Allentown PA.jpg'],
  gas: ['Belgian Troops with Early Gas Masks.jpg', 'Soldiers in trench wearing gas masks 1917.jpg', 'StateLibQld 2 202023 Soldiers drill in their gas masks during World War I.jpg', 'WWI gas masks.jpg'],
  explosao: ['Knocked out of action. Shell-torn ground (2866678577).jpg', 'Shell Explosion Cathedral at Rheims.jpg'],
};
export const PHOTO_CATS = { trincheira: 'Trincheiras', infantaria: 'Infantaria', artilharia: 'Artilharia', tanque: 'Tanques', aviao: 'Aviação', zepelim: 'Zepelins', navio: 'Marinha', submarino: 'Submarinos', cavalaria: 'Cavalaria', ruinas: 'Ruínas', diplomacia: 'Diplomacia', multidao: 'Povo', fabrica: 'Indústria', prisioneiros: 'Prisioneiros', revolta: 'Revoltas', generais: 'Comando', trem: 'Ferrovias', desfile: 'Desfiles', gas: 'Gás', explosao: 'Bombardeios' };
export const photoUrl = (title, w = 640) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}?width=${w}`;
export const photos = cat => (P[cat] || P.trincheira);
// foto determinística para um acontecimento
export function photoFor(cat, seed) { const l = photos(cat); return photoUrl(l[Math.abs(seed | 0) % l.length]); }
export const ALL_PHOTOS = P;
// categoria de foto por tipo de notícia
export const NEWS_PHOTO = { guerra: 'multidao', paz: 'diplomacia', coligacao: 'diplomacia', conquista: 'infantaria', capital: 'ruinas', eliminacao: 'prisioneiros', rebeliao: 'revolta', fim: 'desfile', geral: 'trincheira', batalha: 'trincheira', aereo: 'aviao', naval: 'navio', industria: 'fabrica' };
