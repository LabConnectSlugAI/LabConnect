# LabConnect
Creating a platform to help students find research labs at UCSC would be a fantastic way to bridge the gap between students and faculty while fostering innovation. Here's an outline of how we can structure this platform, along with some key features: 

Platform Name: LabConnect UCSC 

Tagline: "Discover Research, Unlock Opportunities"

npm install @supabase/supabase-js

./src/app/page.tsx:1:10
Ecmascript file had an error
> 1 | import { useState } from 'react';
    |          ^^^^^^^^
  2 | import { supabase } from '../../lib/supabaseClient';
  3 |
  4 | interface Lab {

You're importing a component that needs `useState`. This React hook only works in a client component. To fix, mark the file (or its parent) with the `"use client"` directive.

 Learn more: https://nextjs.org/docs/app/api-reference/directives/use-client