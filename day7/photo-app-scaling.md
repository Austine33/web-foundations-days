# SnapShare Scaling Plan

SnapShare is a photo-sharing app. Users upload photos and scroll a feed of photos from people they follow.

## 1. Assumptions

- 10,000,000 registered users.
- 10% of users are active each day.
- Each active user uploads 1 photo per day.
- Each active user views 50 feed pages per day.
- An average photo is 2 MB. Each photo also gets a 50 KB thumbnail.
- One day has 86,400 seconds.
- Traffic is spread evenly over the day for the average. Peak traffic is 5 times the average.
- 1 TB = 1,000,000 MB.
- Database records (user names, captions, follows) are very small compared with photo files, so they are ignored in the storage estimate.

**Daily active users (DAU):**
10,000,000 x 10% = **1,000,000 users per day**

## 2. Estimates

### Uploads per second
- Uploads per day = 1,000,000 users x 1 photo = 1,000,000 photos
- Average = 1,000,000 / 86,400 = about **12 uploads per second**
- Peak (5x) = about **58 uploads per second**

### Feed views per second
- Feed views per day = 1,000,000 users x 50 = 50,000,000 views
- Average = 50,000,000 / 86,400 = about **579 views per second**
- Peak (5x) = about **2,900 views per second**

### Storage per year
- Size of one upload = 2 MB photo + 0.05 MB thumbnail = 2.05 MB
- Per day = 1,000,000 x 2.05 MB = 2,050,000 MB = about 2.05 TB
- Per year = 2.05 TB x 365 = about **748 TB** (roughly 0.75 petabytes)
  - Original photos: about 730 TB
  - Thumbnails: about 18 TB
- This is one copy only. Real systems keep extra copies for safety, so the real number would be larger.

## 3. Read-heavy or write-heavy?

SnapShare is **read-heavy**. There are 50 feed views for every 1 upload, a ratio of about 50 to 1 (579 views per second compared with 12 uploads per second).

**What this means for the design:**
- Most of our effort should go into making reads fast and cheap.
- We use a CDN and a cache so most requests never reach the database.
- We use a read replica so the main database is not overloaded with read queries.
- Writes are fewer, so a single main database can handle them, and slow jobs (like thumbnails) can be done in the background.

## 4. Why photos should not be stored in the database

- Photos are large. One year of photos is about 748 TB, which would make the database huge, slow and very expensive to back up.
- A database is built for small, structured records, not big files.
- Photos can't easily be served from a database through a CDN.

**Where they go instead:** photos and thumbnails are stored in **object storage**, which is cheap, very large and built for files. The database only stores a small record for each photo (photo ID, user ID, caption, time and the link to the file in object storage).

## 5. Architecture diagram

```
        Users (phones and browsers)
            |                 |
            | photos          | feed and upload requests
            v                 v
        +-------+       +---------------+
        |  CDN  |       | Load Balancer |
        +-------+       +---------------+
            |                  |
            | (on a miss)      v
            |        +--------------------+
            |        | App Servers (many) |
            |        +--------------------+
            |         |      |      |    |
            |  fast   |      |      |    | thumbnail job
            |  reads  v      |      |    v
            |    +-------+   |      |  +-------+     +--------+
            |    | Cache |   |      |  | Queue | --> | Worker |
            |    +-------+   |      |  +-------+     +--------+
            |                |      |                     |
            |       writes   v      | reads               | saves thumbnail
            |     +----------+   +--------------+          |
            |     | Database |-->| Read replica |          |
            |     | (primary)|   +--------------+          |
            |     +----------+                             |
            |                                              |
            |        +----------------------------------+  |
            +------> |  Object storage (photos+thumbs)  | <+
                     +----------------------------------+
```

The app servers also save each original photo into object storage when it is uploaded (this arrow is left out to keep the drawing easy to read).

## 6. What each component does

- **CDN:** Serves photos and thumbnails from servers close to the user, so images load fast and our own servers are not overloaded.
- **Load balancer:** Spreads incoming requests across many app servers so no single server is overwhelmed, and traffic keeps flowing if one server fails.
- **App servers:** Run the SnapShare logic (login, upload, building the feed), and we can add more of them as traffic grows.
- **Cache:** Keeps popular feed data in fast memory so we do not have to ask the database every time.
- **Database (primary):** Stores users, follows and photo records safely, and handles all the writes.
- **Read replica:** A live copy of the database that answers read queries, so the primary is not overloaded.
- **Object storage:** Stores the huge number of photo and thumbnail files cheaply and reliably.
- **Queue:** Holds "make a thumbnail" jobs in order, so an upload does not have to wait for them.
- **Worker:** Picks up jobs from the queue and creates thumbnails in the background.

## 7. Upload flow, step by step

1. The user picks a photo and taps Upload. The request goes to the load balancer.
2. The load balancer sends it to an app server that is free.
3. The app server checks that the user is logged in and that the file is a valid photo of an allowed size.
4. The app server saves the original photo in object storage.
5. The app server writes a small record in the main database (photo ID, user ID, link to the file, time, thumbnail status "pending").
6. The app server adds a job to the queue: "create a thumbnail for photo X".
7. The app server replies to the user: "Upload successful". The user does not wait for the thumbnail.
8. A worker takes the job from the queue, reads the original photo and creates a 50 KB thumbnail.
9. The worker saves the thumbnail in object storage and updates the database record to "thumbnail ready". If the worker fails, the job stays in the queue and is tried again.
10. When followers open their feed, the app server gets the data from the cache (or the read replica), and the CDN delivers the thumbnails and photos.

## 8. Trade-offs

1. **Cache: speed versus fresh data.** The cache makes feeds much faster and reduces database load, but cached data can be slightly out of date, so a new photo may take a moment to appear. We also have to decide when to clear old cache data, which adds complexity.
2. **Read replica: less load versus delay.** The replica takes pressure off the main database, but it copies data with a small delay (replication lag). A user might upload a photo and not see it straight away if their feed is read from the replica.
3. **Queue and worker: fast uploads versus a short wait.** Users get a quick "Upload successful" message, but the thumbnail appears a few seconds later. It also means we have more parts to run and watch.
4. **CDN: speed versus cost.** A CDN makes photos load quickly worldwide, but it costs money, and we have to manage what happens when a photo is changed or deleted while copies are still stored on CDN servers.