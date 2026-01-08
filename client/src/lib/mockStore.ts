import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Artifact {
  type: 'elia15' | 'business_narrative' | 'golden_circle';
  content: string;
  isReady: boolean;
}

export interface Patent {
  id: string;
  title: string;
  assignee: string;
  filingDate: string;
  status: 'processing' | 'elia15_ready' | 'completed';
  artifacts: Artifact[];
  uploadDate: string;
}

export interface User {
  email: string;
  credits: number;
  isAdmin: boolean;
}

interface AppState {
  user: User | null;
  patents: Patent[];
  currentUploadId: string | null;
  
  // Actions
  login: (email: string) => void;
  logout: () => void;
  uploadPatent: (file: File) => string; // Returns ID
  getPatent: (id: string) => Patent | undefined;
  unlockArtifacts: (id: string) => void;
  deductCredits: (amount: number) => void;
}

// Mock content
const MOCK_ELIA15 = `
# Introduction
Imagine you have a super smart robot friend who wants to help you organize your toys. But instead of just throwing them in a box, it knows exactly which toy goes where so you can find it instantly. This invention is kind of like that, but for computers handling really big and complicated tasks.

# The Invention
This invention is a special way for computers to "talk" to each other when they are working together on a big project. It helps them share information faster and without getting confused.

# Detailed Functioning
1. **The Messenger:** Think of a delivery person who knows all the shortcuts. This invention uses a smart "messenger" inside the computer system.
2. **The Map:** The messenger has a map of where all the information needs to go.
3. **Traffic Control:** It also stops "traffic jams" of information so everything moves smoothly.

# Why It Matters
Computers are getting faster, but they still get bogged down when they have too much to do at once. This invention helps them work smarter, not harder, which means your video games load faster and scientists can solve problems quicker.
`;

const MOCK_NARRATIVE = `
## Problem Definition
Current distributed computing systems suffer from significant latency bottlenecks when scaling beyond 1,000 nodes, resulting in 40% wasted computational resources.

## Solution (Your IP)
Our proprietary "Smart Mesh" protocol optimizes node-to-node communication dynamically, reducing latency by up to 60% without requiring hardware upgrades.

## Market Opportunity
The cloud infrastructure market is projected to reach $500B by 2028. This IP directly addresses the efficiency needs of hyperscale data centers (AWS, Azure, Google Cloud).

## Go-to-Market Strategy
We intend to license this technology to major hardware manufacturers (Cisco, Juniper) and cloud providers as a software overlay.
`;

const MOCK_GOLDEN_CIRCLE = `
## WHY
We believe that computing power should be limitless and accessible, not constrained by inefficient communication.

## HOW
We achieve this by fundamentally reimagining the data packet routing algorithms to prioritize context over mere destination.

## WHAT
We provide a software-defined networking protocol that doubles the efficiency of existing data center hardware.
`;

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      patents: [],
      currentUploadId: null,

      login: (email) => set({ 
        user: { 
          email, 
          credits: 100, 
          isAdmin: email.includes('admin') 
        } 
      }),

      logout: () => set({ user: null }),

      uploadPatent: (file) => {
        const id = Math.random().toString(36).substring(7);
        const newPatent: Patent = {
          id,
          title: file.name.replace('.pdf', ''),
          assignee: 'Pending Analysis...',
          filingDate: new Date().toLocaleDateString(),
          status: 'elia15_ready',
          uploadDate: new Date().toLocaleDateString(),
          artifacts: [
            { type: 'elia15', content: MOCK_ELIA15, isReady: true },
            { type: 'business_narrative', content: MOCK_NARRATIVE, isReady: false },
            { type: 'golden_circle', content: MOCK_GOLDEN_CIRCLE, isReady: false },
          ]
        };
        
        set((state) => ({ 
          patents: [newPatent, ...state.patents],
          currentUploadId: id
        }));
        
        return id;
      },

      getPatent: (id) => get().patents.find(p => p.id === id),

      unlockArtifacts: (id) => {
        set((state) => ({
          patents: state.patents.map(p => {
            if (p.id === id) {
              return {
                ...p,
                status: 'completed',
                artifacts: p.artifacts.map(a => ({ ...a, isReady: true }))
              };
            }
            return p;
          })
        }));
      },

      deductCredits: (amount) => {
        set((state) => {
          if (!state.user) return state;
          return {
            user: { ...state.user, credits: Math.max(0, state.user.credits - amount) }
          };
        });
      }
    }),
    {
      name: 'ip-scaffold-storage',
    }
  )
);
