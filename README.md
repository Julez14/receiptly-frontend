# Receipt Scanner App - Setup Guide

This guide will help you set up the Receipt Scanner application locally.

## Prerequisites

- Node.js 20+ installed
- A Supabase account (free tier is sufficient)
- (Optional) Backend OCR API endpoint

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to finish setting up (this takes a few minutes)
3. Note your project URL and anon key from the project settings

## Step 3: Configure Environment Variables

1. Copy the example environment file:

   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. (Optional) Configure OCR API endpoint:
   ```
   NEXT_PUBLIC_API_URL=http://your-backend-api.com/api/ocr
   ```

## Step 5: Verify Storage Bucket

1. In Supabase dashboard, go to Storage
2. Verify that a bucket named "receipts" exists
3. The bucket should have RLS policies already configured

## Step 6: Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 7: Test the Application

1. Click "Get Started" to create a new account
2. Sign up with an email and password
3. You'll be redirected to the dashboard
4. Try uploading a receipt image
5. View your receipts in the "Receipts" page

## Troubleshooting

### Authentication Issues

- Make sure your Supabase URL and anon key are correct
- Check that the database schema was executed successfully
- Verify that RLS policies are enabled

### Image Upload Failures

- Ensure the "receipts" storage bucket exists
- Check that storage policies are configured

## Next Steps

- Customize the styling in `app/globals.css`
- Add expense categories and filtering
- Implement expense charts and analytics
- Set up email verification (in Supabase Auth settings)
- Deploy to Vercel or another hosting platform

## Deployment

When deploying to production:

1. Add environment variables to your hosting platform
2. Update Supabase Auth settings:
   - Add your production URL to "Redirect URLs"
   - Configure email templates
3. Set up proper CORS settings for your OCR API
4. Consider enabling Supabase's built-in CDN for images

## Support

For issues or questions, refer to:

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
