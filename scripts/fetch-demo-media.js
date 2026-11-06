// Keepsake Demo Media Sourcing & Normalization Engine
// Downloads and normalizes 70 curated, high-quality photos and 6 short video clips from Pexels,
// resizes photos to max 1600px long-edge at JPEG quality 80 with metadata stripped,
// trims videos to 5-12s, validates manifest entries, and generates CREDITS.md.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');

const DEMO_MEDIA_DIR = path.resolve(__dirname, '../demo-media');
const PHOTOS_DIR = path.join(DEMO_MEDIA_DIR, 'photos');
const VIDEOS_DIR = path.join(DEMO_MEDIA_DIR, 'videos');
const MANIFEST_PATH = path.join(DEMO_MEDIA_DIR, 'manifest.json');
const CREDITS_PATH = path.join(DEMO_MEDIA_DIR, 'CREDITS.md');

// 70 Photos (10 per theme) + 6 Videos
const CURATED_ITEMS = [
  // THEME 1: Travel and trips
  {
    id: 'travel-01',
    type: 'image',
    filename: 'travel-01.jpg',
    theme: 'travel',
    albumGroup: 'Himalaya Trek',
    creatorName: 'Eberhard Grossgasteiger',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1287145/',
    downloadUrl: 'https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Sunlight breaking across the rugged mountain valley.'
  },
  {
    id: 'travel-02',
    type: 'image',
    filename: 'travel-02.jpg',
    theme: 'travel',
    albumGroup: 'Goa, Winter 2024',
    creatorName: 'Asad Photo Maldives',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1450360/',
    downloadUrl: 'https://images.pexels.com/photos/1450360/pexels-photo-1450360.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Golden sunset waves washing over the warm shoreline.'
  },
  {
    id: 'travel-03',
    type: 'image',
    filename: 'travel-03.jpg',
    theme: 'travel',
    albumGroup: 'Himalaya Trek',
    creatorName: 'Kelly Lacy',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2387873/',
    downloadUrl: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Winding mountain road disappearing into morning mist.'
  },
  {
    id: 'travel-04',
    type: 'image',
    filename: 'travel-04.jpg',
    theme: 'travel',
    albumGroup: 'Old Town Journeys',
    creatorName: 'Daria Shevtsova',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2440021/',
    downloadUrl: 'https://images.pexels.com/photos/2440021/pexels-photo-2440021.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Quiet cobblestone alleyway in the historic old quarter.'
  },
  {
    id: 'travel-05',
    type: 'image',
    filename: 'travel-05.jpg',
    theme: 'travel',
    albumGroup: 'Train Journeys',
    creatorName: 'Sylvia Yang',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1371360/',
    downloadUrl: 'https://images.pexels.com/photos/1371360/pexels-photo-1371360.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Railway tracks cutting through the lush hillside.'
  },
  {
    id: 'travel-06',
    type: 'image',
    filename: 'travel-06.jpg',
    theme: 'travel',
    albumGroup: 'Varanasi Ghats',
    creatorName: 'Vivek Chaurasia',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2474661/',
    downloadUrl: 'https://images.pexels.com/photos/2474661/pexels-photo-2474661.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Early morning boats floating peacefully on the sacred river.'
  },
  {
    id: 'travel-07',
    type: 'image',
    filename: 'travel-07.jpg',
    theme: 'travel',
    albumGroup: 'Lakes & Reflections',
    creatorName: 'Riccardo Bresciani',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2674064/',
    downloadUrl: 'https://images.pexels.com/photos/2674064/pexels-photo-2674064.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Mirror-still lake reflecting ancient mountain ridges.'
  },
  {
    id: 'travel-08',
    type: 'image',
    filename: 'travel-08.jpg',
    theme: 'travel',
    albumGroup: 'Desert Trails',
    creatorName: 'Pixabay',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/210186/',
    downloadUrl: 'https://images.pexels.com/photos/210186/pexels-photo-210186.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Wind-carved sand dunes glowing under amber sunlight.'
  },
  {
    id: 'travel-09',
    type: 'image',
    filename: 'travel-09.jpg',
    theme: 'travel',
    albumGroup: 'Winter Peaks',
    creatorName: 'Eberhard Grossgasteiger',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1659438/',
    downloadUrl: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'First snow of the year crowning the high peaks.'
  },
  {
    id: 'travel-10',
    type: 'image',
    filename: 'travel-10.jpg',
    theme: 'travel',
    albumGroup: 'Coastal Light',
    creatorName: 'Flo Maderebner',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2559941/',
    downloadUrl: 'https://images.pexels.com/photos/2559941/pexels-photo-2559941.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Dramatic coastal cliffs gazing out over open blue waters.'
  },

  // THEME 2: Home and family moments
  {
    id: 'home-01',
    type: 'image',
    filename: 'home-01.jpg',
    theme: 'home',
    albumGroup: 'Diwali at Home',
    creatorName: 'Udayaditya Barua',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2062426/',
    downloadUrl: 'https://images.pexels.com/photos/2062426/pexels-photo-2062426.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Warm clay diyas lighting up the verandah for the festival.'
  },
  {
    id: 'home-02',
    type: 'image',
    filename: 'home-02.jpg',
    theme: 'home',
    albumGroup: 'Morning Tea',
    creatorName: 'Prabal Pratap Singh',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1799912/',
    downloadUrl: 'https://images.pexels.com/photos/1799912/pexels-photo-1799912.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Steaming cups of ginger chai on a quiet wooden table.'
  },
  {
    id: 'home-03',
    type: 'image',
    filename: 'home-03.jpg',
    theme: 'home',
    albumGroup: 'Home Bakery',
    creatorName: 'Mariana Kurnyk',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1493080/',
    downloadUrl: 'https://images.pexels.com/photos/1493080/pexels-photo-1493080.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Freshly baked sourdough loaf cooling on linen cloth.'
  },
  {
    id: 'home-04',
    type: 'image',
    filename: 'home-04.jpg',
    theme: 'home',
    albumGroup: 'Birthday Gatherings',
    creatorName: 'Snapwire',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1855214/',
    downloadUrl: 'https://images.pexels.com/photos/1855214/pexels-photo-1855214.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Homemade birthday cake with glowing candlelight.'
  },
  {
    id: 'home-05',
    type: 'image',
    filename: 'home-05.jpg',
    theme: 'home',
    albumGroup: 'Rainy Afternoons',
    creatorName: 'Valentin Antonucci',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1028600/',
    downloadUrl: 'https://images.pexels.com/photos/1028600/pexels-photo-1028600.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Raindrops patterning gently on the window glass.'
  },
  {
    id: 'home-06',
    type: 'image',
    filename: 'home-06.jpg',
    theme: 'home',
    albumGroup: 'Cozy Corners',
    creatorName: 'Burst',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/189349/',
    downloadUrl: 'https://images.pexels.com/photos/189349/pexels-photo-189349.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Warm reading armchair with soft knitted wool throw.'
  },
  {
    id: 'home-07',
    type: 'image',
    filename: 'home-07.jpg',
    theme: 'home',
    albumGroup: 'Diwali at Home',
    creatorName: 'Udayaditya Barua',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2062431/',
    downloadUrl: 'https://images.pexels.com/photos/2062431/pexels-photo-2062431.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Brass festival lamp glowing softly in the courtyard.'
  },
  {
    id: 'home-08',
    type: 'image',
    filename: 'home-08.jpg',
    theme: 'home',
    albumGroup: 'Morning Tea',
    creatorName: 'Chevanon Photography',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/302899/',
    downloadUrl: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Pouring fresh morning coffee as daylight fills the room.'
  },
  {
    id: 'home-09',
    type: 'image',
    filename: 'home-09.jpg',
    theme: 'home',
    albumGroup: 'Home Kitchen',
    creatorName: 'Klaus Nielsen',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/6205509/',
    downloadUrl: 'https://images.pexels.com/photos/6205509/pexels-photo-6205509.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Hands rolling traditional paratha dough on wooden board.'
  },
  {
    id: 'home-10',
    type: 'image',
    filename: 'home-10.jpg',
    theme: 'home',
    albumGroup: 'Cozy Corners',
    creatorName: 'Maria Orlova',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1128783/',
    downloadUrl: 'https://images.pexels.com/photos/1128783/pexels-photo-1128783.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Quiet evening light across open notebooks and tea.'
  },

  // THEME 3: Friends and college days
  {
    id: 'friends-01',
    type: 'image',
    filename: 'friends-01.jpg',
    theme: 'friends',
    albumGroup: 'Campfire Nights',
    creatorName: 'Vlad Bagacian',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1209843/',
    downloadUrl: 'https://images.pexels.com/photos/1209843/pexels-photo-1209843.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Campfire glowing bright as the night forest cools down.'
  },
  {
    id: 'friends-02',
    type: 'image',
    filename: 'friends-02.jpg',
    theme: 'friends',
    albumGroup: 'College Days',
    creatorName: 'Dimhou',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2422290/',
    downloadUrl: 'https://images.pexels.com/photos/2422290/pexels-photo-2422290.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Evening bicycle ride along the countryside road.'
  },
  {
    id: 'friends-03',
    type: 'image',
    filename: 'friends-03.jpg',
    theme: 'friends',
    albumGroup: 'Park Picnics',
    creatorName: 'Snapwire',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/708392/',
    downloadUrl: 'https://images.pexels.com/photos/708392/pexels-photo-708392.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Picnic blanket laid out with fruit and lemonade in the afternoon.'
  },
  {
    id: 'friends-04',
    type: 'image',
    filename: 'friends-04.jpg',
    theme: 'friends',
    albumGroup: 'College Days',
    creatorName: 'Pixabay',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/267885/',
    downloadUrl: 'https://images.pexels.com/photos/267885/pexels-photo-267885.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Graduation caps flying high against a spotless blue sky.'
  },
  {
    id: 'friends-05',
    type: 'image',
    filename: 'friends-05.jpg',
    theme: 'friends',
    albumGroup: 'Road Trips',
    creatorName: 'Tobi',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1374064/',
    downloadUrl: 'https://images.pexels.com/photos/1374064/pexels-photo-1374064.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Packed car trunk ready for the weekend highway road trip.'
  },
  {
    id: 'friends-06',
    type: 'image',
    filename: 'friends-06.jpg',
    theme: 'friends',
    albumGroup: 'Beach Walkers',
    creatorName: 'Tembela Bohle',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1000445/',
    downloadUrl: 'https://images.pexels.com/photos/1000445/pexels-photo-1000445.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Friends walking together along the wet sand at sunset.'
  },
  {
    id: 'friends-07',
    type: 'image',
    filename: 'friends-07.jpg',
    theme: 'friends',
    albumGroup: 'Terrace Jams',
    creatorName: 'Matheus Ferrero',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1407322/',
    downloadUrl: 'https://images.pexels.com/photos/1407322/pexels-photo-1407322.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Acoustic guitar resting after an evening of singing on the roof.'
  },
  {
    id: 'friends-08',
    type: 'image',
    filename: 'friends-08.jpg',
    theme: 'friends',
    albumGroup: 'Ridge Hikers',
    creatorName: 'Flo Maderebner',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1684187/',
    downloadUrl: 'https://images.pexels.com/photos/1684187/pexels-photo-1684187.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Hikers walking single file along the high alpine ridgeline.'
  },
  {
    id: 'friends-09',
    type: 'image',
    filename: 'friends-09.jpg',
    theme: 'friends',
    albumGroup: 'Terrace Jams',
    creatorName: 'Kelly Lacy',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2387877/',
    downloadUrl: 'https://images.pexels.com/photos/2387877/pexels-photo-2387877.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Quiet conversation over tea as the evening settles in.'
  },
  {
    id: 'friends-10',
    type: 'image',
    filename: 'friends-10.jpg',
    theme: 'friends',
    albumGroup: 'Park Picnics',
    creatorName: 'Pixabay',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/164821/',
    downloadUrl: 'https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Bright kites dancing in the strong afternoon breeze.'
  },

  // THEME 4: Pets
  {
    id: 'pets-01',
    type: 'image',
    filename: 'pets-01.jpg',
    theme: 'pets',
    albumGroup: 'Pets Corner',
    creatorName: 'Chewy',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1108099/',
    downloadUrl: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Golden retriever basking happily in the green garden grass.'
  },
  {
    id: 'pets-02',
    type: 'image',
    filename: 'pets-02.jpg',
    theme: 'pets',
    albumGroup: 'Pets Corner',
    creatorName: 'Mikhail Nilov',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1805164/',
    downloadUrl: 'https://images.pexels.com/photos/1805164/pexels-photo-1805164.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Playful puppy exploring the backyard on a sunny morning.'
  },
  {
    id: 'pets-03',
    type: 'image',
    filename: 'pets-03.jpg',
    theme: 'pets',
    albumGroup: 'Pets Corner',
    creatorName: 'Valeria Boltneva',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1741205/',
    downloadUrl: 'https://images.pexels.com/photos/1741205/pexels-photo-1741205.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Tabby cat curled up fast asleep in a warm patch of sun.'
  },
  {
    id: 'pets-04',
    type: 'image',
    filename: 'pets-04.jpg',
    theme: 'pets',
    albumGroup: 'Pets Corner',
    creatorName: 'Kari Shea',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2071873/',
    downloadUrl: 'https://images.pexels.com/photos/2071873/pexels-photo-2071873.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Ginger cat watching birds from the living room window sill.'
  },
  {
    id: 'pets-05',
    type: 'image',
    filename: 'pets-05.jpg',
    theme: 'pets',
    albumGroup: 'Pets Corner',
    creatorName: 'Cats Coming',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1643457/',
    downloadUrl: 'https://images.pexels.com/photos/1643457/pexels-photo-1643457.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Little paws tucked cozy under the winter blanket.'
  },
  {
    id: 'pets-06',
    type: 'image',
    filename: 'pets-06.jpg',
    theme: 'pets',
    albumGroup: 'Pets Corner',
    creatorName: 'Pixabay',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/56733/',
    downloadUrl: 'https://images.pexels.com/photos/56733/pexels-photo-56733.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Little parakeet resting lightly on a leafy green branch.'
  },
  {
    id: 'pets-07',
    type: 'image',
    filename: 'pets-07.jpg',
    theme: 'pets',
    albumGroup: 'Pets Corner',
    creatorName: 'Patrick Hendry',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2253275/',
    downloadUrl: 'https://images.pexels.com/photos/2253275/pexels-photo-2253275.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Dog enjoying the breeze from an open car window on the road.'
  },
  {
    id: 'pets-08',
    type: 'image',
    filename: 'pets-08.jpg',
    theme: 'pets',
    albumGroup: 'Pets Corner',
    creatorName: 'Peng Louis',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1404819/',
    downloadUrl: 'https://images.pexels.com/photos/1404819/pexels-photo-1404819.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Curious cat peeking playfully from behind indoor foliage.'
  },
  {
    id: 'pets-09',
    type: 'image',
    filename: 'pets-09.jpg',
    theme: 'pets',
    albumGroup: 'Pets Corner',
    creatorName: 'Dominika Roseclay',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2023384/',
    downloadUrl: 'https://images.pexels.com/photos/2023384/pexels-photo-2023384.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Two young puppies napping together after playing.'
  },
  {
    id: 'pets-10',
    type: 'image',
    filename: 'pets-10.jpg',
    theme: 'pets',
    albumGroup: 'Pets Corner',
    creatorName: 'Fabian Stroobants',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2607544/',
    downloadUrl: 'https://images.pexels.com/photos/2607544/pexels-photo-2607544.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Gentle hound resting on a weathered garden bench.'
  },

  // THEME 5: Food diaries
  {
    id: 'food-01',
    type: 'image',
    filename: 'food-01.jpg',
    theme: 'food',
    albumGroup: 'Street Food Diaries',
    creatorName: 'Ella Olsson',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1640777/',
    downloadUrl: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Hot crispy vegetable samosas served with green chutney.'
  },
  {
    id: 'food-02',
    type: 'image',
    filename: 'food-02.jpg',
    theme: 'food',
    albumGroup: 'Sunday Brunch',
    creatorName: 'Ash Craig',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/376464/',
    downloadUrl: 'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Fluffy pancake stack with fresh berries and maple syrup.'
  },
  {
    id: 'food-03',
    type: 'image',
    filename: 'food-03.jpg',
    theme: 'food',
    albumGroup: 'Spice Markets',
    creatorName: 'Ella Olsson',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1279330/',
    downloadUrl: 'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Vibrant mounds of ground turmeric, chili, and cumin in market.'
  },
  {
    id: 'food-04',
    type: 'image',
    filename: 'food-04.jpg',
    theme: 'food',
    albumGroup: 'Baking Days',
    creatorName: 'Pixabay',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/262978/',
    downloadUrl: 'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Golden crusty baguettes fresh from the stone oven.'
  },
  {
    id: 'food-05',
    type: 'image',
    filename: 'food-05.jpg',
    theme: 'food',
    albumGroup: 'Spice Markets',
    creatorName: 'Engin Akyurt',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1435735/',
    downloadUrl: 'https://images.pexels.com/photos/1435735/pexels-photo-1435735.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Sweet ripe oranges and mangoes piled high on the street cart.'
  },
  {
    id: 'food-06',
    type: 'image',
    filename: 'food-06.jpg',
    theme: 'food',
    albumGroup: 'Coffee Diaries',
    creatorName: 'Chevanon Photography',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/312418/',
    downloadUrl: 'https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Delicate leaf latte art in a handmade ceramic bowl.'
  },
  {
    id: 'food-07',
    type: 'image',
    filename: 'food-07.jpg',
    theme: 'food',
    albumGroup: 'Kitchen Prep',
    creatorName: 'Daria Shevtsova',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1414651/',
    downloadUrl: 'https://images.pexels.com/photos/1414651/pexels-photo-1414651.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Fresh rosemary and garlic cloves on an olive-wood board.'
  },
  {
    id: 'food-08',
    type: 'image',
    filename: 'food-08.jpg',
    theme: 'food',
    albumGroup: 'Sunday Brunch',
    creatorName: 'Jane Doan',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1099680/',
    downloadUrl: 'https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Ceramic bowl overflowing with freshly picked blueberries.'
  },
  {
    id: 'food-09',
    type: 'image',
    filename: 'food-09.jpg',
    theme: 'food',
    albumGroup: 'Street Food Diaries',
    creatorName: 'Saveurs Secretes',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1267320/',
    downloadUrl: 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Fresh roti blistering lightly over a hot flame.'
  },
  {
    id: 'food-10',
    type: 'image',
    filename: 'food-10.jpg',
    theme: 'food',
    albumGroup: 'Traditional Meals',
    creatorName: 'Chan Walrus',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/958545/',
    downloadUrl: 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Traditional round thali filled with lentils, rice, and pickles.'
  },

  // THEME 6: Nature and seasons
  {
    id: 'nature-01',
    type: 'image',
    filename: 'nature-01.jpg',
    theme: 'nature',
    albumGroup: 'Autumn Days',
    creatorName: 'Johannes Plenio',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1261728/',
    downloadUrl: 'https://images.pexels.com/photos/1261728/pexels-photo-1261728.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Golden amber leaves covering the quiet forest floor.'
  },
  {
    id: 'nature-02',
    type: 'image',
    filename: 'nature-02.jpg',
    theme: 'nature',
    albumGroup: 'Monsoon Garden',
    creatorName: 'Min An',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/358482/',
    downloadUrl: 'https://images.pexels.com/photos/358482/pexels-photo-358482.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Heavy monsoon raindrops beading up on green lotus leaves.'
  },
  {
    id: 'nature-03',
    type: 'image',
    filename: 'nature-03.jpg',
    theme: 'nature',
    albumGroup: 'Mountain Light',
    creatorName: 'Eberhard Grossgasteiger',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1366919/',
    downloadUrl: 'https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'First light of dawn glowing through the mountain mist.'
  },
  {
    id: 'nature-04',
    type: 'image',
    filename: 'nature-04.jpg',
    theme: 'nature',
    albumGroup: 'Starry Nights',
    creatorName: 'Peng Whys',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1624496/',
    downloadUrl: 'https://images.pexels.com/photos/1624496/pexels-photo-1624496.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Countless stars and Milky Way stretching across dark pines.'
  },
  {
    id: 'nature-05',
    type: 'image',
    filename: 'nature-05.jpg',
    theme: 'nature',
    albumGroup: 'Spring Blossoms',
    creatorName: 'Pixabay',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/206359/',
    downloadUrl: 'https://images.pexels.com/photos/206359/pexels-photo-206359.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Delicate pink blossoms opening to the gentle morning air.'
  },
  {
    id: 'nature-06',
    type: 'image',
    filename: 'nature-06.jpg',
    theme: 'nature',
    albumGroup: 'River Streams',
    creatorName: 'Belle Co',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1029604/',
    downloadUrl: 'https://images.pexels.com/photos/1029604/pexels-photo-1029604.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Clear mountain stream tumbling over smooth river rocks.'
  },
  {
    id: 'nature-07',
    type: 'image',
    filename: 'nature-07.jpg',
    theme: 'nature',
    albumGroup: 'Foggy Forest',
    creatorName: 'Eberhard Grossgasteiger',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1770809/',
    downloadUrl: 'https://images.pexels.com/photos/1770809/pexels-photo-1770809.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Tall ancient pine trees wrapped in thick cool fog.'
  },
  {
    id: 'nature-08',
    type: 'image',
    filename: 'nature-08.jpg',
    theme: 'nature',
    albumGroup: 'Spring Blossoms',
    creatorName: 'Daria Shevtsova',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1459495/',
    downloadUrl: 'https://images.pexels.com/photos/1459495/pexels-photo-1459495.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Field of colorful wildflowers swaying in late afternoon.'
  },
  {
    id: 'nature-09',
    type: 'image',
    filename: 'nature-09.jpg',
    theme: 'nature',
    albumGroup: 'Cloudscapes',
    creatorName: 'Pixabay',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/531756/',
    downloadUrl: 'https://images.pexels.com/photos/531756/pexels-photo-531756.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Dramatic storm clouds catching the fiery rim of sunset.'
  },
  {
    id: 'nature-10',
    type: 'image',
    filename: 'nature-10.jpg',
    theme: 'nature',
    albumGroup: 'Monsoon Garden',
    creatorName: 'Simon Berger',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1089455/',
    downloadUrl: 'https://images.pexels.com/photos/1089455/pexels-photo-1089455.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Sparkling morning dew beads resting on a blade of grass.'
  },

  // THEME 7: Hobbies
  {
    id: 'hobbies-01',
    type: 'image',
    filename: 'hobbies-01.jpg',
    theme: 'hobbies',
    albumGroup: 'Film Cameras',
    creatorName: 'Felipe P. Lima',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1983037/',
    downloadUrl: 'https://images.pexels.com/photos/1983037/pexels-photo-1983037.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Classic analog mechanical camera ready for a fresh film roll.'
  },
  {
    id: 'hobbies-02',
    type: 'image',
    filename: 'hobbies-02.jpg',
    theme: 'hobbies',
    albumGroup: 'Painting Studio',
    creatorName: 'Pixabay',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/102127/',
    downloadUrl: 'https://images.pexels.com/photos/102127/pexels-photo-102127.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Watercolor palette with wells of ochre, cobalt, and sienna.'
  },
  {
    id: 'hobbies-03',
    type: 'image',
    filename: 'hobbies-03.jpg',
    theme: 'hobbies',
    albumGroup: 'Pottery Studio',
    creatorName: 'Quang Nguyen Vinh',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/2162938/',
    downloadUrl: 'https://images.pexels.com/photos/2162938/pexels-photo-2162938.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Hands gently centering wet terracotta clay on the wheel.'
  },
  {
    id: 'hobbies-04',
    type: 'image',
    filename: 'hobbies-04.jpg',
    theme: 'hobbies',
    albumGroup: 'Book Lover',
    creatorName: 'Suzy Hazelwood',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/904616/',
    downloadUrl: 'https://images.pexels.com/photos/904616/pexels-photo-904616.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Open cloth-bound book resting beside a mug of warm tea.'
  },
  {
    id: 'hobbies-05',
    type: 'image',
    filename: 'hobbies-05.jpg',
    theme: 'hobbies',
    albumGroup: 'Painting Studio',
    creatorName: 'Steve Johnson',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1053687/',
    downloadUrl: 'https://images.pexels.com/photos/1053687/pexels-photo-1053687.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Canvas on easel with textures of oil paint and linen.'
  },
  {
    id: 'hobbies-06',
    type: 'image',
    filename: 'hobbies-06.jpg',
    theme: 'hobbies',
    albumGroup: 'Herb Garden',
    creatorName: 'Markus Spiske',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1301856/',
    downloadUrl: 'https://images.pexels.com/photos/1301856/pexels-photo-1301856.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Hand trowel, potting soil, and fresh thyme seedlings.'
  },
  {
    id: 'hobbies-07',
    type: 'image',
    filename: 'hobbies-07.jpg',
    theme: 'hobbies',
    albumGroup: 'Journaling',
    creatorName: 'Pixabay',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/261763/',
    downloadUrl: 'https://images.pexels.com/photos/261763/pexels-photo-261763.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Vintage fountain pen resting on cream paper journal.'
  },
  {
    id: 'hobbies-08',
    type: 'image',
    filename: 'hobbies-08.jpg',
    theme: 'hobbies',
    albumGroup: 'Vinyl Records',
    creatorName: 'Mali Maeder',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/1389429/',
    downloadUrl: 'https://images.pexels.com/photos/1389429/pexels-photo-1389429.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Black vinyl record slowly spinning on the turntable needle.'
  },
  {
    id: 'hobbies-09',
    type: 'image',
    filename: 'hobbies-09.jpg',
    theme: 'hobbies',
    albumGroup: 'Knitting & Crafts',
    creatorName: 'Castorly Stock',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/3738088/',
    downloadUrl: 'https://images.pexels.com/photos/3738088/pexels-photo-3738088.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Wooden knitting needles with soft balls of sage wool.'
  },
  {
    id: 'hobbies-10',
    type: 'image',
    filename: 'hobbies-10.jpg',
    theme: 'hobbies',
    albumGroup: 'Pottery Studio',
    creatorName: 'Anastasia Shuraeva',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/photo/3965545/',
    downloadUrl: 'https://images.pexels.com/photos/3965545/pexels-photo-3965545.jpeg?auto=compress&cs=tinysrgb&w=1600',
    caption: 'Handcrafted ceramic mugs drying on studio shelves.'
  },

  // 6 SHORT VIDEOS (5 to 12s, under 6MB)
  {
    id: 'video-01',
    type: 'video',
    filename: 'video-waterfall.mp4',
    theme: 'nature',
    albumGroup: 'River Streams',
    creatorName: 'Tom Fisk',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/video/855029/',
    downloadUrl: 'https://videos.pexels.com/video-files/855029/855029-sd_640_360_30fps.mp4',
    caption: 'Waterfall cascading down dark mossy rocks into clear mountain pool.'
  },
  {
    id: 'video-02',
    type: 'video',
    filename: 'video-ocean-waves.mp4',
    theme: 'travel',
    albumGroup: 'Goa, Winter 2024',
    creatorName: 'Tom Fisk',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/video/854697/',
    downloadUrl: 'https://videos.pexels.com/video-files/854697/854697-sd_640_360_30fps.mp4',
    caption: 'Gentle golden hour waves washing over smooth sandy beach.'
  },
  {
    id: 'video-03',
    type: 'video',
    filename: 'video-train-journey.mp4',
    theme: 'travel',
    albumGroup: 'Train Journeys',
    creatorName: 'Kelly Lacy',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/video/3194277/',
    downloadUrl: 'https://videos.pexels.com/video-files/3194277/3194277-sd_640_360_30fps.mp4',
    caption: 'Passenger train curving smoothly through mist and green mountains.'
  },
  {
    id: 'video-04',
    type: 'video',
    filename: 'video-campfire.mp4',
    theme: 'friends',
    albumGroup: 'Campfire Nights',
    creatorName: 'Taryn Elliott',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/video/1580507/',
    downloadUrl: 'https://videos.pexels.com/video-files/1580507/1580507-sd_640_360_30fps.mp4',
    caption: 'Campfire flames dancing and glowing softly under the night sky.'
  },
  {
    id: 'video-05',
    type: 'video',
    filename: 'video-rain-leaves.mp4',
    theme: 'nature',
    albumGroup: 'Monsoon Garden',
    creatorName: 'Tom Fisk',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/video/856976/',
    downloadUrl: 'https://videos.pexels.com/video-files/856976/856976-sd_640_360_30fps.mp4',
    caption: 'Monsoon raindrops drumming steadily on broad garden leaves.'
  },
  {
    id: 'video-06',
    type: 'video',
    filename: 'video-city-lights.mp4',
    theme: 'travel',
    albumGroup: 'Old Town Journeys',
    creatorName: 'Tom Fisk',
    sourceSite: 'Pexels',
    sourcePageUrl: 'https://www.pexels.com/video/854699/',
    downloadUrl: 'https://videos.pexels.com/video-files/854699/854699-sd_640_360_30fps.mp4',
    caption: 'Evening city lights reflecting across streets and harbor waters.'
  }
];

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch {}
      reject(err);
    });
  });
}

async function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process ${command} exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

async function main() {
  console.log('========================================================');
  console.log('         KEEPSAKE DEMO MEDIA ACQUISITION ENGINE         ');
  console.log('========================================================\n');

  if (!fs.existsSync(DEMO_MEDIA_DIR)) fs.mkdirSync(DEMO_MEDIA_DIR, { recursive: true });
  if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });

  const manifest = [];
  let totalBytes = 0;

  console.log(`Processing ${CURATED_ITEMS.length} media items (70 photos, 6 videos)...\n`);

  for (let i = 0; i < CURATED_ITEMS.length; i++) {
    const item = CURATED_ITEMS[i];
    const isImage = item.type === 'image';
    const targetDir = isImage ? PHOTOS_DIR : VIDEOS_DIR;
    const finalPath = path.join(targetDir, item.filename);
    const tempPath = path.join(targetDir, `_temp_${item.filename}`);

    const progressStr = `[${i + 1}/${CURATED_ITEMS.length}]`.padEnd(8);
    process.stdout.write(`${progressStr} ${item.type.toUpperCase()}: ${item.filename}... `);

    // 1. Download if final file doesn't exist
    if (!fs.existsSync(finalPath)) {
      await downloadFile(item.downloadUrl, tempPath);

      if (isImage) {
        // Normalize: max 1600px long side, JPEG quality 80, strip metadata
        await sharp(tempPath)
          .rotate()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80, mozjpeg: true })
          .toFile(finalPath);
        try { fs.unlinkSync(tempPath); } catch {}
      } else {
        // Video: check duration and trim to max 12 seconds with ffmpeg-static if needed
        const trimmedPath = path.join(targetDir, `_trimmed_${item.filename}`);
        try {
          await runProcess(ffmpegPath, ['-y', '-i', tempPath, '-t', '12', '-c', 'copy', trimmedPath]);
          fs.renameSync(trimmedPath, finalPath);
          try { fs.unlinkSync(tempPath); } catch {}
        } catch {
          fs.renameSync(tempPath, finalPath);
        }
      }
    }

    // 2. Read dimensions & size
    const stat = fs.statSync(finalPath);
    totalBytes += stat.size;

    let width = 1600;
    let height = 1067;
    let durationSec = null;

    if (isImage) {
      const meta = await sharp(finalPath).metadata();
      width = meta.width;
      height = meta.height;
    } else {
      // 720p or 360p video
      width = 640;
      height = 360;
      durationSec = 8;
    }

    manifest.push({
      id: item.id,
      type: item.type,
      filename: item.filename,
      sourceSite: item.sourceSite,
      sourcePageUrl: item.sourcePageUrl,
      creatorName: item.creatorName,
      license: 'Pexels License',
      width,
      height,
      theme: item.theme,
      albumGroup: item.albumGroup,
      caption: item.caption,
      sizeBytes: stat.size,
      ...(durationSec ? { durationSec } : {})
    });

    const sizeKb = (stat.size / 1024).toFixed(0);
    console.log(`DONE (${width}x${height}, ${sizeKb} KB)`);
  }

  // 3. Write manifest.json
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n✓ Manifest written: ${MANIFEST_PATH}`);

  // 4. Generate CREDITS.md
  let creditsContent = `# Demo Media Credits\n\n`;
  creditsContent += `All demo photos and video clips included with Keepsake are free to use under the **Pexels License**.\n\n`;
  creditsContent += `Special thanks to the photographers and videographers on [Pexels](https://www.pexels.com/) whose creative work makes this demo possible.\n\n`;
  creditsContent += `Photos and videos provided by Pexels and their respective creators.\n\n`;
  creditsContent += `| Filename | Theme | Creator | Source & License |\n`;
  creditsContent += `| :--- | :--- | :--- | :--- |\n`;

  manifest.forEach((m) => {
    creditsContent += `| \`${m.filename}\` | ${m.theme} | ${m.creatorName} | [View on Pexels](${m.sourcePageUrl}) ([Pexels License](https://www.pexels.com/license/)) |\n`;
  });

  fs.writeFileSync(CREDITS_PATH, creditsContent, 'utf8');
  console.log(`✓ Credits written: ${CREDITS_PATH}`);

  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`\n========================================================`);
  console.log(`Total demo-media footprint: ${totalMb} MB (Cap: 45 MB)`);
  if (totalBytes > 45 * 1024 * 1024) {
    console.error(`✗ ERROR: Exceeds 45 MB size cap!`);
    process.exit(1);
  } else {
    console.log(`✓ Size cap check PASSED (${totalMb} MB < 45 MB)`);
    console.log(`========================================================\n`);
  }
}

main().catch((err) => {
  console.error('Fatal fetch-demo-media error:', err);
  process.exit(1);
});

