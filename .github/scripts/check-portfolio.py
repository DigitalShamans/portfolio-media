"""Run the offline portfolio source checks shared by PRs and publication."""

import ast
import json
from pathlib import Path
import shlex
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]


def run(*command):
    print('+ ' + shlex.join(command), flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'Duplicate JSON key: {key!r}')
        result[key] = value
    return result


def invalid_constant(value):
    raise ValueError(f'Invalid JSON constant: {value}')


def main():
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode('utf-8')
    paths = sorted(Path(name) for name in tracked.split('\0') if name)
    counts = {'JavaScript': 0, 'JSON': 0, 'Python': 0}
    for path in paths:
        try:
            if path.suffix in {'.js', '.cjs', '.mjs'}:
                run('node', '--check', str(path))
                counts['JavaScript'] += 1
            elif path.suffix == '.json':
                json.loads((ROOT / path).read_text(encoding='utf-8-sig'),
                           object_pairs_hook=unique_object, parse_constant=invalid_constant)
                counts['JSON'] += 1
            elif path.suffix == '.py':
                ast.parse((ROOT / path).read_text(encoding='utf-8-sig'), filename=str(path))
                counts['Python'] += 1
        except (OSError, ValueError, SyntaxError) as error:
            raise ValueError(f'{path}: {error}') from error
    print('Source syntax passed: ' + ', '.join(f'{count} {kind}' for kind, count in counts.items()), flush=True)

    tests = [str(path) for path in paths if path.parent == Path('.github/tests')
             and path.name.endswith(('.test.cjs', '.test.mjs')) and '.browser.test.' not in path.name]
    if not tests:
        raise ValueError('No offline Node regression tests found.')
    run('node', '--test', *tests)
    run('python3', '-m', 'unittest', 'discover', '--start-directory', '.github/tests', '--pattern', 'test_*.py')
    for validator in ('validate-public-galleries.cjs', 'validate-gallery-embeds.cjs', 'validate-gallery-maps.cjs'):
        run('node', '.github/scripts/' + validator)
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f'Portfolio checks failed: {error}', file=sys.stderr)
        sys.exit(1)
