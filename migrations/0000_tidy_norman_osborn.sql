CREATE TABLE "ad_view_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"advertisement_id" integer NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password" text NOT NULL,
	"department" text NOT NULL,
	"position" text NOT NULL,
	"phone" text NOT NULL,
	"user_type" text DEFAULT '일반어드민' NOT NULL,
	"approval_status" text DEFAULT '대기중' NOT NULL,
	"status" text DEFAULT '활성화' NOT NULL,
	"last_login" timestamp,
	"last_logout" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"username" text NOT NULL,
	"assigned_match_number" text,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email"),
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "advertisements" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_name" text NOT NULL,
	"earned_points" integer DEFAULT 4 NOT NULL,
	"video_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"attendance_date" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"content" text NOT NULL,
	"author_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ebook_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"ebook_id" integer NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ebooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"stadium_id" integer NOT NULL,
	"match_date" date,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"match_status" text DEFAULT 'scheduled' NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL,
	"prediction_enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"author_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"match_id" varchar NOT NULL,
	"round_number" integer DEFAULT 1 NOT NULL,
	"prediction" text NOT NULL,
	"amount" integer DEFAULT 100 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" text,
	"won_amount" integer DEFAULT 0 NOT NULL,
	"donated_amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "predictions_user_id_match_id_round_number_unique" UNIQUE("user_id","match_id","round_number")
);
--> statement-breakpoint
CREATE TABLE "round_statistics" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" varchar NOT NULL,
	"round_number" integer NOT NULL,
	"total_participants" integer DEFAULT 0 NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"total_winners" integer DEFAULT 0 NOT NULL,
	"prediction_start_time" timestamp,
	"prediction_stop_time" timestamp,
	"is_prediction_started" boolean DEFAULT false NOT NULL,
	"is_prediction_stopped" boolean DEFAULT false NOT NULL,
	"is_result_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stadiums" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stadiums_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"invite_code" text,
	"referral_code" text,
	"verification_code" text,
	"verification_code_expiry" timestamp,
	"points" integer DEFAULT 0 NOT NULL,
	"last_attendance_date" timestamp,
	"is_suspended" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_online" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp,
	"last_logout_at" timestamp,
	"total_donation_amount" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "waiting_screens" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_name" text NOT NULL,
	"display_duration" integer DEFAULT 4 NOT NULL,
	"video_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_view_history" ADD CONSTRAINT "ad_view_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_view_history" ADD CONSTRAINT "ad_view_history_advertisement_id_advertisements_id_fk" FOREIGN KEY ("advertisement_id") REFERENCES "public"."advertisements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebook_purchases" ADD CONSTRAINT "ebook_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebook_purchases" ADD CONSTRAINT "ebook_purchases_ebook_id_ebooks_id_fk" FOREIGN KEY ("ebook_id") REFERENCES "public"."ebooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_stadium_id_stadiums_id_fk" FOREIGN KEY ("stadium_id") REFERENCES "public"."stadiums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_statistics" ADD CONSTRAINT "round_statistics_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;