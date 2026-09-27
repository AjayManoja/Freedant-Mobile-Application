# Notification service

Owns **telling users what happened**. Only reacts to events, so the rest of the system keeps working if it is down; missed events are delivered when it comes back.

- **Data:** notifications (per user, with read state)
- **Responsibilities:** in-app notification list and unread count (MVP); push notifications and WebSocket realtime (later)
- **Publishes:** —
- **Consumes:** `user.registered`, `competition.published`, `registration.confirmed`, `results.published`, `refund.completed`
- **Built in:** Sprint 6
