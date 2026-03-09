export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-12">
      <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
        <p>
          RecallRadar is not affiliated with NHTSA. Data sourced from the{" "}
          <a
            href="https://www.nhtsa.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-700"
          >
            National Highway Traffic Safety Administration
          </a>{" "}
          public API.
        </p>
        <p className="mt-1">
          &copy; {new Date().getFullYear()} RecallRadar. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
