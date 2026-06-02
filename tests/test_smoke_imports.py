import importlib


def test_core_modules_are_importable():
    for module_name in ["config", "extract", "markov", "roas"]:
        importlib.import_module(module_name)


def test_entrypoints_are_importable_without_running_pipeline():
    for module_name in ["run", "run_quarter"]:
        module = importlib.import_module(module_name)
        assert hasattr(module, "main")
