const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../server/app');

(async () => {
  console.log('--- Starting Bloomly Phase 2 Real HTTP Walkthrough ---');
  let mongod;
  let server;

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const PORT = 5055;
    server = app.listen(PORT);
    const BASE_URL = `http://127.0.0.1:${PORT}`;

    // Step 1: Register User A
    const regResA = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'alice_gardener',
        email: 'alice@bloomly.test',
        password: 'Password123',
        displayName: 'Alice Gardener',
        moodSticker: 'flower'
      })
    });
    const regDataA = await regResA.json();
    const cookieA = regResA.headers.get('set-cookie');
    console.log(`Step 1a: Register Alice -> Status ${regResA.status} (User ID: ${regDataA.user?.id})`);

    // Step 1: Register User B
    const regResB = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'bob_planter',
        email: 'bob@bloomly.test',
        password: 'Password123',
        displayName: 'Bob Planter',
        moodSticker: 'plant'
      })
    });
    const regDataB = await regResB.json();
    const cookieB = regResB.headers.get('set-cookie');
    console.log(`Step 1b: Register Bob -> Status ${regResB.status} (User ID: ${regDataB.user?.id})`);

    // Step 2: Alice creates a post
    const postRes = await fetch(`${BASE_URL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA
      },
      body: JSON.stringify({
        text: 'Morning morning! The camellia is blooming today.'
      })
    });
    const postData = await postRes.json();
    const postId = postData.post?.id;
    console.log(`Step 2: Alice creates post -> Status ${postRes.status} (Post ID: ${postId})`);

    // Step 3: Bob follows Alice
    const followRes = await fetch(`${BASE_URL}/api/users/${regDataA.user.id}/follow`, {
      method: 'POST',
      headers: { Cookie: cookieB }
    });
    const followData = await followRes.json();
    console.log(`Step 3: Bob follows Alice -> Status ${followRes.status} (Following: ${followData.following})`);

    // Step 4: Bob sees post in feed
    const feedRes = await fetch(`${BASE_URL}/api/posts/feed`, {
      headers: { Cookie: cookieB }
    });
    const feedData = await feedRes.json();
    const feedHasPost = feedData.items?.some((p) => p.id === postId);
    console.log(`Step 4: Bob checks feed -> Status ${feedRes.status} (Found Alice post: ${feedHasPost}, Total items: ${feedData.items?.length})`);

    // Step 5a: Bob likes post
    const likeRes = await fetch(`${BASE_URL}/api/posts/${postId}/like`, {
      method: 'POST',
      headers: { Cookie: cookieB }
    });
    const likeData = await likeRes.json();
    console.log(`Step 5a: Bob likes post -> Status ${likeRes.status} (Liked: ${likeData.liked}, Likes count: ${likeData.likesCount})`);

    // Step 5b: Bob comments on post
    const commentRes = await fetch(`${BASE_URL}/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB
      },
      body: JSON.stringify({
        text: 'Such beautiful flowers, Alice!'
      })
    });
    const commentData = await commentRes.json();
    console.log(`Step 5b: Bob comments on post -> Status ${commentRes.status} (Comment ID: ${commentData.comment?.id})`);

    // Step 6a: Alice checks unread notification count
    const unreadRes = await fetch(`${BASE_URL}/api/notifications/unread-count`, {
      headers: { Cookie: cookieA }
    });
    const unreadData = await unreadRes.json();
    console.log(`Step 6a: Alice checks unread count -> Status ${unreadRes.status} (Unread count: ${unreadData.count})`);

    // Step 6b: Alice lists notifications
    const notifsRes = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { Cookie: cookieA }
    });
    const notifsData = await notifsRes.json();
    console.log(`Step 6b: Alice lists notifications -> Status ${notifsRes.status} (Items count: ${notifsData.items?.length}, Types: ${notifsData.items?.map(n => n.type).join(', ')})`);

    // Step 7: Alice marks all as read
    const markReadRes = await fetch(`${BASE_URL}/api/notifications/read`, {
      method: 'PUT',
      headers: { Cookie: cookieA }
    });
    const markReadData = await markReadRes.json();
    const unreadAfterRes = await fetch(`${BASE_URL}/api/notifications/unread-count`, {
      headers: { Cookie: cookieA }
    });
    const unreadAfterData = await unreadAfterRes.json();
    console.log(`Step 7: Alice marks read -> Status ${markReadRes.status} (Unread count now: ${unreadAfterData.count})`);

    // Step 8: Bob unfollows Alice
    const unfollowRes = await fetch(`${BASE_URL}/api/users/${regDataA.user.id}/follow`, {
      method: 'POST',
      headers: { Cookie: cookieB }
    });
    const unfollowData = await unfollowRes.json();
    console.log(`Step 8: Bob unfollows Alice -> Status ${unfollowRes.status} (Following: ${unfollowData.following})`);

    // Step 9: Alice deletes the post
    const deleteRes = await fetch(`${BASE_URL}/api/posts/${postId}`, {
      method: 'DELETE',
      headers: { Cookie: cookieA }
    });
    const deleteData = await deleteRes.json();
    console.log(`Step 9: Alice deletes post -> Status ${deleteRes.status} (${deleteData.message})`);

    console.log('--- Walkthrough Finished Successfully ---');
  } catch (err) {
    console.error('Walkthrough error:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }
})();
