import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface CreateReviewData {
  review_insert: Review_Key;
}

export interface CreateReviewVariables {
  sessionId: UUIDString;
  rating: number;
  comment?: string | null;
}

export interface CreateSessionData {
  session_insert: Session_Key;
}

export interface CreateSessionVariables {
  menteeId: UUIDString;
  skillId: UUIDString;
  status: string;
}

export interface CreateSkillData {
  skill_insert: Skill_Key;
}

export interface CreateSkillVariables {
  name: string;
  category: string;
  description?: string | null;
}

export interface CreateUserData {
  user_insert: User_Key;
}

export interface CreateUserSkillData {
  userSkill_insert: UserSkill_Key;
}

export interface CreateUserSkillVariables {
  skillId: UUIDString;
  proficiency: string;
}

export interface CreateUserVariables {
  username: string;
  email: string;
  bio: string;
}

export interface DeleteReviewData {
  review_delete?: Review_Key | null;
}

export interface DeleteReviewVariables {
  id: UUIDString;
}

export interface DeleteSessionData {
  session_delete?: Session_Key | null;
}

export interface DeleteSessionVariables {
  id: UUIDString;
}

export interface DeleteSkillData {
  skill_delete?: Skill_Key | null;
}

export interface DeleteSkillVariables {
  id: UUIDString;
}

export interface DeleteUserData {
  user_delete?: User_Key | null;
}

export interface DeleteUserSkillData {
  userSkill_delete?: UserSkill_Key | null;
}

export interface DeleteUserSkillVariables {
  id: UUIDString;
}

export interface GetCurrentUserData {
  user?: {
    username: string;
    email: string;
    bio: string;
  };
}

export interface GetReviewData {
  review?: {
    rating: number;
    comment?: string | null;
  };
}

export interface GetReviewVariables {
  id: UUIDString;
}

export interface GetSessionData {
  session?: {
    status: string;
    scheduledAt?: TimestampString | null;
    notes?: string | null;
  };
}

export interface GetSessionVariables {
  id: UUIDString;
}

export interface GetSkillData {
  skill?: {
    name: string;
    category: string;
    description?: string | null;
  };
}

export interface GetSkillVariables {
  id: UUIDString;
}

export interface GetUserSkillData {
  userSkill?: {
    proficiencyLevel: string;
    skill: {
      name: string;
    };
  };
}

export interface GetUserSkillVariables {
  id: UUIDString;
}

export interface ListMySessionsData {
  sessions: ({
    status: string;
    scheduledAt?: TimestampString | null;
  })[];
}

export interface ListMySkillsData {
  userSkills: ({
    proficiencyLevel: string;
    skill: {
      name: string;
    };
  })[];
}

export interface ListReviewsData {
  reviews: ({
    rating: number;
    comment?: string | null;
    reviewer: {
      username: string;
    };
  })[];
}

export interface ListSkillsData {
  skills: ({
    name: string;
    category: string;
  })[];
}

export interface ListUsersData {
  users: ({
    username: string;
    bio: string;
    location?: string | null;
  })[];
}

export interface Review_Key {
  id: UUIDString;
  __typename?: 'Review_Key';
}

export interface Session_Key {
  id: UUIDString;
  __typename?: 'Session_Key';
}

export interface Skill_Key {
  id: UUIDString;
  __typename?: 'Skill_Key';
}

export interface UpdateReviewData {
  review_update?: Review_Key | null;
}

export interface UpdateReviewVariables {
  id: UUIDString;
  rating: number;
}

export interface UpdateSessionData {
  session_update?: Session_Key | null;
}

export interface UpdateSessionVariables {
  id: UUIDString;
  status: string;
}

export interface UpdateSkillData {
  skill_update?: Skill_Key | null;
}

export interface UpdateSkillVariables {
  id: UUIDString;
  description?: string | null;
}

export interface UpdateUserData {
  user_update?: User_Key | null;
}

export interface UpdateUserSkillData {
  userSkill_update?: UserSkill_Key | null;
}

export interface UpdateUserSkillVariables {
  id: UUIDString;
  proficiency: string;
}

export interface UpdateUserVariables {
  bio?: string | null;
}

export interface UserSkill_Key {
  id: UUIDString;
  __typename?: 'UserSkill_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to execute without passing in DataConnect. */
export function createUser(dc: DataConnect, vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUser(vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUser' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUser(dc: DataConnect, vars?: UpdateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUser(vars?: UpdateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteUser' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteUser(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteUser(options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserData>>;

/** Generated Node Admin SDK operation action function for the 'GetCurrentUser' Query. Allow users to execute without passing in DataConnect. */
export function getCurrentUser(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCurrentUserData>>;
/** Generated Node Admin SDK operation action function for the 'GetCurrentUser' Query. Allow users to pass in custom DataConnect instances. */
export function getCurrentUser(options?: OperationOptions): Promise<ExecuteOperationResponse<GetCurrentUserData>>;

/** Generated Node Admin SDK operation action function for the 'ListUsers' Query. Allow users to execute without passing in DataConnect. */
export function listUsers(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListUsersData>>;
/** Generated Node Admin SDK operation action function for the 'ListUsers' Query. Allow users to pass in custom DataConnect instances. */
export function listUsers(options?: OperationOptions): Promise<ExecuteOperationResponse<ListUsersData>>;

/** Generated Node Admin SDK operation action function for the 'CreateSkill' Mutation. Allow users to execute without passing in DataConnect. */
export function createSkill(dc: DataConnect, vars: CreateSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSkillData>>;
/** Generated Node Admin SDK operation action function for the 'CreateSkill' Mutation. Allow users to pass in custom DataConnect instances. */
export function createSkill(vars: CreateSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSkillData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateSkill' Mutation. Allow users to execute without passing in DataConnect. */
export function updateSkill(dc: DataConnect, vars: UpdateSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSkillData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateSkill' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateSkill(vars: UpdateSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSkillData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteSkill' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteSkill(dc: DataConnect, vars: DeleteSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSkillData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteSkill' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteSkill(vars: DeleteSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSkillData>>;

/** Generated Node Admin SDK operation action function for the 'GetSkill' Query. Allow users to execute without passing in DataConnect. */
export function getSkill(dc: DataConnect, vars: GetSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSkillData>>;
/** Generated Node Admin SDK operation action function for the 'GetSkill' Query. Allow users to pass in custom DataConnect instances. */
export function getSkill(vars: GetSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSkillData>>;

/** Generated Node Admin SDK operation action function for the 'ListSkills' Query. Allow users to execute without passing in DataConnect. */
export function listSkills(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSkillsData>>;
/** Generated Node Admin SDK operation action function for the 'ListSkills' Query. Allow users to pass in custom DataConnect instances. */
export function listSkills(options?: OperationOptions): Promise<ExecuteOperationResponse<ListSkillsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateUserSkill' Mutation. Allow users to execute without passing in DataConnect. */
export function createUserSkill(dc: DataConnect, vars: CreateUserSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserSkillData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUserSkill' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUserSkill(vars: CreateUserSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserSkillData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUserSkill' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUserSkill(dc: DataConnect, vars: UpdateUserSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserSkillData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUserSkill' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUserSkill(vars: UpdateUserSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserSkillData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteUserSkill' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteUserSkill(dc: DataConnect, vars: DeleteUserSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserSkillData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteUserSkill' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteUserSkill(vars: DeleteUserSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserSkillData>>;

/** Generated Node Admin SDK operation action function for the 'GetUserSkill' Query. Allow users to execute without passing in DataConnect. */
export function getUserSkill(dc: DataConnect, vars: GetUserSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserSkillData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserSkill' Query. Allow users to pass in custom DataConnect instances. */
export function getUserSkill(vars: GetUserSkillVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserSkillData>>;

/** Generated Node Admin SDK operation action function for the 'ListMySkills' Query. Allow users to execute without passing in DataConnect. */
export function listMySkills(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMySkillsData>>;
/** Generated Node Admin SDK operation action function for the 'ListMySkills' Query. Allow users to pass in custom DataConnect instances. */
export function listMySkills(options?: OperationOptions): Promise<ExecuteOperationResponse<ListMySkillsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateSession' Mutation. Allow users to execute without passing in DataConnect. */
export function createSession(dc: DataConnect, vars: CreateSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSessionData>>;
/** Generated Node Admin SDK operation action function for the 'CreateSession' Mutation. Allow users to pass in custom DataConnect instances. */
export function createSession(vars: CreateSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSessionData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateSession' Mutation. Allow users to execute without passing in DataConnect. */
export function updateSession(dc: DataConnect, vars: UpdateSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSessionData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateSession' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateSession(vars: UpdateSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSessionData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteSession' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteSession(dc: DataConnect, vars: DeleteSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSessionData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteSession' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteSession(vars: DeleteSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSessionData>>;

/** Generated Node Admin SDK operation action function for the 'GetSession' Query. Allow users to execute without passing in DataConnect. */
export function getSession(dc: DataConnect, vars: GetSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSessionData>>;
/** Generated Node Admin SDK operation action function for the 'GetSession' Query. Allow users to pass in custom DataConnect instances. */
export function getSession(vars: GetSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSessionData>>;

/** Generated Node Admin SDK operation action function for the 'ListMySessions' Query. Allow users to execute without passing in DataConnect. */
export function listMySessions(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMySessionsData>>;
/** Generated Node Admin SDK operation action function for the 'ListMySessions' Query. Allow users to pass in custom DataConnect instances. */
export function listMySessions(options?: OperationOptions): Promise<ExecuteOperationResponse<ListMySessionsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateReview' Mutation. Allow users to execute without passing in DataConnect. */
export function createReview(dc: DataConnect, vars: CreateReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateReviewData>>;
/** Generated Node Admin SDK operation action function for the 'CreateReview' Mutation. Allow users to pass in custom DataConnect instances. */
export function createReview(vars: CreateReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateReviewData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateReview' Mutation. Allow users to execute without passing in DataConnect. */
export function updateReview(dc: DataConnect, vars: UpdateReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateReviewData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateReview' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateReview(vars: UpdateReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateReviewData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteReview' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteReview(dc: DataConnect, vars: DeleteReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteReviewData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteReview' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteReview(vars: DeleteReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteReviewData>>;

/** Generated Node Admin SDK operation action function for the 'GetReview' Query. Allow users to execute without passing in DataConnect. */
export function getReview(dc: DataConnect, vars: GetReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetReviewData>>;
/** Generated Node Admin SDK operation action function for the 'GetReview' Query. Allow users to pass in custom DataConnect instances. */
export function getReview(vars: GetReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetReviewData>>;

/** Generated Node Admin SDK operation action function for the 'ListReviews' Query. Allow users to execute without passing in DataConnect. */
export function listReviews(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListReviewsData>>;
/** Generated Node Admin SDK operation action function for the 'ListReviews' Query. Allow users to pass in custom DataConnect instances. */
export function listReviews(options?: OperationOptions): Promise<ExecuteOperationResponse<ListReviewsData>>;

