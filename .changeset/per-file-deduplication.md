---
"permaweb-deploy": minor
---

Add per-file deduplication for folder uploads

- Folder uploads now cache and deduplicate at the file level instead of the entire folder
- Only changed files are re-uploaded on subsequent deployments
- Deployment output now shows cache hits, total files, and uploaded file counts
- Removed stale `hashFolder` function in favor of per-file hashing
