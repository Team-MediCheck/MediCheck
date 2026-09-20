import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "macmini.sh"


class DockerConfigTests(unittest.TestCase):
    def check_config(self, config):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source"
            source.mkdir()
            (source / "backend/server").mkdir(parents=True)
            (source / "backend/server/.gitkeep").touch()
            (source / "docker-compose.local.yml").write_text("services: {}\n")
            for args in (["init", "-q"], ["add", "."],
                         ["-c", "user.name=테스트", "-c", "user.email=test@example.invalid",
                          "commit", "-qm", "테스트 배포 소스 준비"]):
                subprocess.run(["git", *args], cwd=source, check=True, capture_output=True)

            deploy = root / "environment"
            (deploy / "backend/server").mkdir(parents=True)
            (deploy / ".env.local").touch()
            (deploy / "backend/server/.env.prod").touch()
            original = root / "docker-original"
            original.mkdir()
            (original / "contexts").mkdir()
            original_file = original / "config.json"
            if config is not None:
                original_file.write_text(json.dumps(config, indent=2))
            before = original_file.read_bytes() if original_file.exists() else None
            marker = root / "verified-config-path"
            binaries = root / "bin"
            binaries.mkdir()
            docker = binaries / "docker"
            docker.write_text(f"#!{sys.executable}\n" + '''
import json, os, pathlib, stat, sys
args = sys.argv[1:]
if args == ['info']:
    pass
elif args == ['context', 'show']:
    print('default')
elif args[0] == 'compose' and args[-2:] == ['config', '--quiet']:
    directory = pathlib.Path(os.environ['DOCKER_CONFIG'])
    path = directory / 'config.json'
    assert json.loads(path.read_text()) == json.loads(os.environ['EXPECTED_CONFIG'])
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert (directory / 'contexts').resolve() == pathlib.Path(os.environ['ORIGINAL_CONTEXTS']).resolve()
    pathlib.Path(os.environ['CONFIG_MARKER']).write_text(str(directory))
elif args[0] == 'inspect':
    print('healthy')
elif args[:2] == ['exec', 'medicheck-backend']:
    print('UP')
else:
    raise AssertionError('Unexpected Docker command: ' + repr(args))
''')
            docker.chmod(0o700)
            env = dict(os.environ, PATH=str(binaries) + os.pathsep + os.environ['PATH'],
                       DEPLOY_PATH=str(deploy), VERIFY_ONLY='true',
                       DOCKER_CONFIG=str(original), RELEASE_ROOT=str(root / "releases"),
                       EXPECTED_CONFIG=json.dumps(config or {}), CONFIG_MARKER=str(marker),
                       ORIGINAL_CONTEXTS=str(original / "contexts"))
            result = subprocess.run(["bash", str(SCRIPT)], cwd=source, env=env,
                                    capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("no containers changed", result.stdout)
            self.assertTrue(marker.exists())
            self.assertFalse(Path(marker.read_text()).exists(), "Temporary credentials must be removed")
            self.assertEqual(original_file.read_bytes() if original_file.exists() else None, before)
            self.assertEqual(list((root / "releases").iterdir()), [])

    def test_preserves_authentication_helpers_and_other_settings(self):
        self.check_config({
            "auths": {"registry.example.invalid": {"auth": "dummy-test-auth"}},
            "credsStore": "runner-helper",
            "credHelpers": {"private.example.invalid": "registry-helper"},
            "currentContext": "default",
            "proxies": {"default": {"noProxy": "localhost"}},
        })

    def test_missing_original_config_allows_anonymous_use(self):
        self.check_config(None)
