# LANDING-HERO-12: Stretch Root Cause

## The Problem
The Hero Grid on the Landing Page utilized `lg:items-stretch` (`align-items: stretch`).
This behavior forces all columns in a CSS grid to match the height of the tallest column in the row.

In this layout, the Left Column (Copy + CTA + Proof + Rail) naturally requires significant vertical space. Consequently, the Right Column (the Player) was forced to expand its height to match the Left Column, completely disregarding its own content's natural height requirements.

Inside the Player, the Reader used `h-full` to occupy the stretched height, which in turn caused the sibling `Playlist` grid cell to stretch vertically, generating unnatural whitespace.

## The Solution
Changed `lg:items-stretch` to `lg:items-start` on the Hero grid.
The Player column now evaluates its height solely based on the Player component, finishing well before the bottom of the Hero section, creating the exact decoupled layout requested.
