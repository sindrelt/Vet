export function PetArt() {
  return (
    <div className="pet-art" aria-hidden="true">
      <svg viewBox="0 0 430 340" role="presentation">
        <defs>
          <pattern id="grain" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r=".6" fill="#cfc8ae" opacity=".35" />
          </pattern>
        </defs>
        <path
          d="M39 257C-6 174 49 59 148 37c100-22 192-3 231 75 46 94-5 188-109 197-96 9-194 17-231-52"
          fill="#e4e9d9"
        />
        <path
          d="M45 258C-5 184 49 59 148 37c100-22 192-3 231 75 46 94-5 188-109 197-96 9-194 17-225-51"
          fill="url(#grain)"
        />
        <ellipse cx="218" cy="300" rx="143" ry="12" fill="#ccd5bf" />
        <path
          d="M76 290c-30-27-19-60 1-65 23-6 33 18 23 31"
          fill="none"
          stroke="#bc714e"
          strokeWidth="17"
          strokeLinecap="round"
        />
        <path d="M102 298c-12-75 3-117 54-120 48-2 70 42 52 120" fill="#bd7753" />
        <path d="M144 221c15-7 28-6 39 2l4 77h-48" fill="#f3d7b6" />
        <path
          d="M113 297l4-46M186 297l-1-42"
          fill="none"
          stroke="#91583f"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M110 125c-30-30-49-11-43 33 3 24 20 44 40 29M197 125c29-30 49-11 43 33-4 24-20 44-40 29"
          fill="#8d543e"
        />
        <path
          d="M100 135c3-32 27-49 56-47 35 1 56 26 54 62-1 41-17 66-53 66-36-1-57-33-57-81"
          fill="#c9855b"
        />
        <path
          d="M154 91c-11 28-12 42-2 58 5 8 19 9 26 27 7 17-1 34-21 34-25-1-41-19-35-37 6-17 27-20 24-41l-3-38"
          fill="#f4ddc0"
        />
        <ellipse cx="132" cy="145" rx="5" ry="7" fill="#2b3730" />
        <ellipse cx="184" cy="145" rx="5" ry="7" fill="#2b3730" />
        <path d="M145 173q12-11 25 0-2 14-13 15-12-1-12-15" fill="#2b3730" />
        <path
          d="M157 188v8m-14 0q14 10 28 0"
          fill="none"
          stroke="#2b3730"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M100 203q55 27 110-1l-1 14q-50 23-108-1" fill="#254c3b" />
        <circle cx="158" cy="223" r="8" fill="#e6be69" />
        <path
          d="M296 295c42-7 62-29 55-48-7-22-32-16-25 0"
          fill="none"
          stroke="#838d82"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path d="M246 298c-4-48-5-84 32-86 37-1 46 34 42 86" fill="#9ca69a" />
        <path
          d="M248 219c-20-14-22-41-15-67l26 20q20-5 36 1l23-21c12 35 7 58-14 69-16 11-42 11-56-2"
          fill="#9ca69a"
        />
        <path d="M238 164l15 14-13 8M313 164l-15 14 15 8" fill="#d5b4a3" />
        <path d="M261 251q15-16 30 0l5 47h-37" fill="#e9ece1" />
        <path
          d="M249 197q6-6 12 0m29 0q6-6 12 0"
          stroke="#263d32"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M271 206h11l-6 6z" fill="#815c53" />
        <path
          d="M276 212v6m-8-1q8 7 16 0m-34-8-21-3m21 10-20 4m72-11 21-3m-21 10 20 4"
          stroke="#44564b"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M338 82c-8-15-27-6-22 6 4 10 22 18 22 18s18-14 18-24c-1-14-18-14-18 0"
          fill="#bc7258"
          transform="rotate(13 338 90)"
        />
        <path
          d="m65 85 0 14m-7-7h14m293 130v12m-6-6h12"
          stroke="#758b65"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <div className="art-label">
        <span className="art-label-icon">♥</span>
        <span>
          God omsorg.
          <br />
          <strong>Et oversiktlig valg.</strong>
        </span>
      </div>
    </div>
  );
}
