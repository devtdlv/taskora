# Taskora

Taskora is a project management platform for teams to organize their work, manage projects and tasks, collaborate, and track progress.

## Overview

A user can create or join multiple workspaces. Each workspace contains its own members, projects, tasks, notifications, and activity.

Taskora is designed as a multi-tenant SaaS application. Data belonging to one workspace must remain isolated from other workspaces.

The first version will focus on the core project management experience. Additional functionality such as billing, integrations, real-time collaboration, and public APIs can be introduced later.

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Next.js Route Handlers
- Zod for input validation
- Service layer for business logic
- Repository layer for database access

### Database

- PostgreSQL
- Prisma ORM

### Infrastructure

- Docker
- Redis
- GitHub Actions
- AWS

Redis will be introduced where it provides a clear benefit, such as caching, queues, rate limiting, or real-time functionality.

### Testing

- Vitest
- Playwright

## Core Structure

A workspace is the main organizational boundary in Taskora.

The general domain structure is:

    Workspace
    ├── Members
    ├── Projects
    │   ├── Members
    │   └── Boards
    │       └── Tasks
    │           ├── Assignees
    │           ├── Labels
    │           ├── Subtasks
    │           ├── Comments
    │           └── Activity
    ├── Notifications
    └── Analytics

A user can belong to multiple workspaces.

Projects belong to a workspace.

Tasks belong to projects.

Resources inside a workspace must not be accessible to users who do not have permission to access that workspace.

## Users

A user represents an individual Taskora account.

Users will have information such as:

- Name
- Email address
- Profile image
- Account creation date
- Last update date

A user may belong to multiple workspaces with different roles in each workspace.

For example, the same user could be an `OWNER` of one workspace and a `MEMBER` of another.

## Authentication

Users will be able to:

- Create an account
- Log in
- Log out
- Reset their password
- Manage their profile

Authentication identifies the user.

Authorization determines what that authenticated user is allowed to do.

These concerns should remain separate throughout the application.

## Workspaces

Workspaces provide separation between organizations or teams using Taskora.

Users will be able to:

- Create a workspace
- View workspace details
- Update workspace details
- View workspace members
- Invite members
- Remove members
- Change member roles
- Leave a workspace

Each workspace should have at least one owner.

Deleting or transferring ownership of a workspace will require additional safeguards.

### Workspace Roles

Taskora initially supports four workspace roles:

- `OWNER`
- `ADMIN`
- `MEMBER`
- `GUEST`

### OWNER

Owners have full control over the workspace.

Typical permissions include:

- Update workspace settings
- Delete the workspace
- Manage members
- Manage member roles
- Create and manage projects
- Transfer ownership

### ADMIN

Administrators help manage the workspace but do not own it.

Typical permissions include:

- Manage members
- Create and manage projects
- Manage most workspace resources

Some sensitive actions should remain restricted to owners.

### MEMBER

Members are regular workspace participants.

Typical permissions include:

- View projects they have access to
- Create and update tasks where permitted
- Comment on tasks
- Participate in project work

### GUEST

Guests have limited access.

Guest access may be restricted to specific projects rather than the entire workspace.

The exact permission model will be refined as the application is implemented.

## Workspace Invitations

Workspace owners and administrators can invite users to join a workspace.

An invitation should contain information such as:

- Email address
- Workspace
- Intended role
- Invitation status
- Expiration
- Created date

Invitation states may include:

- Pending
- Accepted
- Expired
- Revoked

The application must prevent unauthorized users from accepting invitations intended for someone else.

## Projects

Projects belong to a workspace.

A workspace can contain multiple projects.

Users with the appropriate permissions will be able to:

- Create projects
- View projects
- Update projects
- Archive projects
- Restore archived projects
- Assign project members
- Set project status
- Set project due dates
- View project activity

A project may contain information such as:

- Name
- Description
- Status
- Start date
- Due date
- Created by
- Created date
- Updated date

Projects should normally be archived rather than permanently deleted.

## Project Members

Projects may have their own membership in addition to workspace membership.

This allows a workspace to contain projects that are only visible to certain members.

A project member must also belong to the project's workspace.

Project access must always be verified on the server.

## Boards

Projects can contain a board used to organize tasks visually.

The initial version will focus on a Kanban-style board.

A board contains columns representing task statuses.

Example:

    Backlog
        ↓
    To Do
        ↓
    In Progress
        ↓
    Review
        ↓
    Done

Workspaces or projects may eventually support custom workflows.

## Kanban Board

The Kanban board will support:

- Custom columns
- Custom task statuses
- Drag and drop
- Task reordering
- Moving tasks between columns
- Persisting task positions

Moving a task must update its status and position in the database.

Task ordering should remain consistent when multiple tasks are moved.

Real-time synchronization between multiple users is not required for the initial version.

## Tasks

Tasks are the primary unit of work in Taskora.

A task may contain:

- Title
- Description
- Status
- Priority
- Due date
- Assignees
- Labels
- Subtasks
- Comments
- Activity history
- Created by
- Created date
- Updated date

Users with the appropriate permissions will be able to:

- Create tasks
- View tasks
- Update tasks
- Delete or archive tasks
- Assign users
- Change priority
- Change status
- Set due dates
- Add labels
- Create subtasks
- Comment on tasks

## Task Priorities

Initial task priorities will include:

- LOW
- MEDIUM
- HIGH
- URGENT

Priority values should be represented consistently throughout the database, API, and interface.

## Task Status

Task status is determined by the board column or workflow state associated with the task.

Statuses should not be hardcoded into application logic where custom project workflows are expected.

## Task Assignees

Tasks may be assigned to one or more users.

Only users with access to the relevant workspace and project should be assignable.

The application must verify this on the server rather than relying on the list of users displayed by the client.

## Subtasks

Tasks can contain subtasks.

Subtasks represent smaller pieces of work required to complete a parent task.

The initial implementation should avoid unlimited recursive nesting unless a clear requirement emerges.

## Labels

Projects can use labels to categorize tasks.

Examples might include:

- Bug
- Feature
- Design
- Backend
- Frontend
- Documentation

Labels should be customizable.

A task can have multiple labels.

## Comments

Project members can discuss work directly on tasks.

Comments will support:

- Creating comments
- Editing comments
- Deleting comments
- Mentions
- Comment activity

Users should only be able to edit or delete comments when permitted.

The original author should normally be able to edit their own comments.

Administrative moderation rules can be added where appropriate.

## Activity History

Important actions should create activity records.

Examples include:

- Task created
- Task assigned
- Status changed
- Priority changed
- Due date changed
- Comment added
- Project archived

Activity records provide context about how a project or task changed over time.

They may also be used later for notifications and analytics.

## Notifications

Taskora will notify users about relevant activity.

Initial notification types include:

- Task assignments
- Mentions
- New comments
- Upcoming due dates

Notifications may contain:

- Recipient
- Notification type
- Related resource
- Message
- Read status
- Created date

Users will be able to:

- View notifications
- Mark a notification as read
- Mark a notification as unread
- Mark all notifications as read

Email and push notifications are outside the initial version.

## Analytics

Workspaces and projects will provide basic reporting.

Initial metrics include:

- Total tasks
- Tasks by status
- Tasks by assignee
- Completed tasks
- Overdue tasks
- Project completion progress

Analytics should be calculated from application data rather than maintaining unnecessary duplicate values unless performance requirements later justify aggregation.

## Search

Basic search may be introduced during the initial version if required by the interface.

Advanced search is considered a future feature.

Eventually users should be able to search across:

- Projects
- Tasks
- Comments
- Members

## Application Architecture

Application requests should generally follow this flow:

    Client
      ↓
    Route Handler
      ↓
    Validation
      ↓
    Service
      ↓
    Authorization
      ↓
    Repository
      ↓
    Prisma
      ↓
    PostgreSQL

This structure is intended to keep HTTP handling, business logic, authorization, and database access separated.

It should not be treated as a requirement to add unnecessary layers to trivial operations.

## Route Handlers

Route handlers are responsible for HTTP concerns.

Typical responsibilities include:

- Reading requests
- Checking authentication
- Validating input
- Calling the appropriate service
- Returning responses
- Mapping known application errors to appropriate HTTP responses

Business logic should remain outside route handlers.

## Validation

External input must be validated before being used by application services.

Zod will initially be used for request validation.

Validation includes data received from:

- Forms
- API requests
- URL parameters
- Query parameters
- External services

TypeScript types alone are not sufficient validation for runtime input.

## Services

Services contain application and business logic.

Examples include:

- `WorkspaceService`
- `ProjectService`
- `TaskService`
- `InvitationService`
- `NotificationService`

Services may coordinate:

- Authorization
- Repositories
- Transactions
- Notifications
- Activity records
- Other application behavior

Services should remain focused on business behavior rather than HTTP implementation details.

## Repositories

Repositories handle database access.

They provide a boundary between application logic and Prisma queries.

Repositories should help prevent database logic from being duplicated throughout the application.

A repository abstraction should only be introduced when it improves clarity, testability, or maintainability.

Simple database operations should not be made unnecessarily complicated.

## Database

PostgreSQL is the primary application database.

Prisma will initially provide:

- Database schema management
- Migrations
- Type-safe database access
- Query functionality

Database constraints should be used where they provide meaningful data integrity.

Application validation should not be treated as a replacement for database constraints.

## Multi-Tenancy

Taskora uses workspace-based multi-tenancy.

Workspace data must remain isolated.

Every request involving workspace-owned data must verify that the authenticated user has permission to access that workspace and resource.

The application must not assume that a resource belongs to a workspace simply because both IDs were provided by the client.

For example, a request containing:

    workspaceId = A
    taskId = B

must verify that task B actually belongs to a project within workspace A and that the current user has permission to access it.

## Authorization

Authorization must always be enforced on the server.

The interface may hide actions that a user cannot perform, but hiding a button is not a security mechanism.

Authorization rules should consider:

- Authentication
- Workspace membership
- Workspace role
- Project membership
- Resource ownership
- Requested action

Important authorization behavior should be covered by automated tests.

## Security

Because Taskora is multi-tenant, access control is a core security requirement.

The application must:

- Enforce authorization on the server
- Verify workspace membership
- Verify project access
- Validate external input
- Prevent cross-workspace data access
- Avoid exposing sensitive information through API responses
- Treat client-provided identifiers as untrusted input
- Avoid leaking internal errors to users

Additional security controls will be introduced as relevant features are implemented.

## Error Handling

Expected application errors should be handled consistently.

Examples include:

- Authentication required
- Permission denied
- Resource not found
- Invalid input
- Duplicate resource
- Expired invitation

Unexpected errors should be logged without exposing sensitive implementation details to the client.

## Code Guidelines

- Use TypeScript strict mode.
- Avoid `any` unless there is a specific reason for it.
- Prefer explicit types at important application boundaries.
- Use Server Components by default.
- Use Client Components when browser-side interactivity is required.
- Keep business logic outside React components.
- Keep route handlers focused on HTTP concerns.
- Validate external input.
- Enforce authorization server-side.
- Avoid unnecessary dependencies.
- Prefer clear code over unnecessary abstraction.
- Keep functions focused on a specific responsibility.
- Avoid duplicating important business rules.
- Add tests for important business behavior and authorization rules.
- Follow the existing structure and conventions of the project when adding new code.

## Testing Strategy

Testing will focus on behavior that would cause meaningful problems if it failed.

### Unit Tests

Unit tests should cover important isolated business logic where appropriate.

Examples:

- Permission checks
- Task ordering
- Invitation rules
- Status transitions

### Integration Tests

Integration tests should cover behavior involving application services and the database.

Examples:

- Creating workspaces
- Adding members
- Creating projects
- Assigning tasks
- Preventing unauthorized access

### End-to-End Tests

Playwright will be used for important user flows.

Examples:

- Registration and login
- Creating a workspace
- Creating a project
- Creating and moving a task
- Inviting a workspace member

Not every implementation detail requires a test.

Tests should focus on behavior and important failure cases.

## Development Workflow

Taskora will be built incrementally.

A typical feature will move through:

1. Define the expected behavior.
2. Design or update the data model.
3. Define permissions and authorization rules.
4. Implement backend behavior.
5. Test the behavior.
6. Build the interface.
7. Review and refactor.
8. Commit the completed work.

Features should be kept small enough to understand, test, and review.

## Git Workflow

The `main` branch should remain in a working state.

Feature work may use branches such as:

    feature/workspace-creation
    feature/project-management
    feature/task-comments
    feature/kanban-board

Commit messages should describe the purpose of the change.

Examples:

    feat: add workspace creation
    feat: add project member management
    fix: prevent cross-workspace task access
    test: add workspace authorization tests
    refactor: extract task repository
    docs: document project architecture
    chore: configure local database

Commits should represent meaningful units of work rather than large unrelated changes.

## Local Development

The application will initially run locally.

The expected development environment will include:

- Next.js application
- PostgreSQL
- Redis when required
- Docker for local infrastructure

The application itself may run directly through Node.js during development while supporting services run through Docker.

## Deployment

Taskora is a portfolio project and is not planned for deployment. It runs locally, and its CI pipeline runs against a throwaway PostgreSQL service. The README's deployment notes are optional technical documentation for anyone hosting their own copy.

## Future Features

The following features are outside the initial core scope but may be introduced later:

- File attachments
- Real-time collaboration
- Email notifications
- Push notifications
- Calendar view
- Recurring tasks
- Time tracking
- Saved filters
- Advanced search
- Project templates
- Workspace templates
- Public API
- API keys
- Webhooks
- Third-party integrations
- Import and export
- Billing and subscriptions
- Usage limits
- Advanced analytics
- Audit logs
- Mobile application

## Project Principles

Taskora should remain understandable as it grows.

Technical complexity should be introduced when there is a concrete reason for it rather than simply to make the architecture appear more sophisticated.

Security boundaries, particularly workspace isolation and authorization, should be treated as part of the application design rather than features added later.

Major architectural decisions should be documented when they materially affect how the system is built, operated, or maintained.