"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { BLOG_POSTS } from "@/lib/blog/posts";

/**
 * Blog HatexCard — lis atik yo.
 * Stil: menm jan ak landing (#F7F8FA, ble #1d4ed8).
 */

export default function BlogPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900 font-sans selection:bg-blue-100 pb-24">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-[#1d4ed8] hover:bg-slate-50 transition-colors shadow-sm"
            aria-label="Retounen"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <img
              src="/img/hatexcard-logo.png"
              alt=""
              className="w-8 h-8 rounded-lg border border-slate-200 object-cover"
            />
            <span className="font-extrabold text-[16px] tracking-tight">
              Hatex<span className="text-[#1d4ed8]">card</span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 border-l border-slate-200 pl-3 ml-1">
              Blog
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-5 md:p-8 mt-6">
        <div className="flex items-start gap-4 mb-12">
          <div className="w-14 h-14 bg-[#1d4ed8] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20 shrink-0">
            <BookOpen size={26} />
          </div>
          <div>
            <p className="text-[#1d4ed8] text-xs font-extrabold uppercase tracking-[0.25em] mb-1">
              Nouvèl & Konsèy
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              Blog HatexCard
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-2 max-w-xl">
              Konsèy pou machann, e-commerce, API, ak sekirite — tout sou fason pou
              resevwa peman MonCash an Goud.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm hover:border-[#1d4ed8]/40 hover:shadow-md transition-all group"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#1d4ed8] bg-blue-50 border border-blue-100 px-3 py-1 rounded-md">
                  {post.category}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {post.date} · {post.readMin} min li
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-2 group-hover:text-[#1d4ed8] transition-colors leading-snug">
                {post.title}
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed font-medium mb-5">
                {post.desc}
              </p>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1d4ed8] group-hover:gap-3 transition-all">
                Li atik la <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
